"use strict";

const db = require("../config/database");

// Mock the notification IO helper
const mockEmits = [];
const socketsHelper = require("../sockets/notifications");
socketsHelper.getNotificationIO = () => ({
  emitNotification: (type, data, targetUserId, isAdmin) => {
    console.log(`[Mock Socket Emit] type: ${type}, targetUserId: ${targetUserId}, isAdmin: ${isAdmin}, message: "${data.message || data.title}"`);
    mockEmits.push({ type, data, targetUserId, isAdmin });
  }
});

const { runCheckMissed } = require("../backendutil/reminderScheduler");

const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runVerify() {
  console.log("🚀 Starting Verification Test for New Notification Logic (3 Missed Reminders = 1 Notification)...");

  // Clean up
  await queryAsync("DELETE FROM lead_reminders WHERE reminder_notes = 'NEW_LOGIC_TEST'");
  await queryAsync("DELETE FROM lead_escalations WHERE customer_name = 'Test Lead New Logic'");
  await queryAsync("DELETE FROM Telecalls WHERE customer_name = 'Test Lead New Logic'");

  // Create test lead
  const leadResult = await queryAsync(
    `INSERT INTO Telecalls (customer_name, mobile_number, location_city, call_date, staff_name, created_by, assigned_to, email) 
     VALUES ('Test Lead New Logic', '9876543210', 'Test City', CURDATE(), 'Test Staff', 1, 1, 'test@example.com')`
  );
  const leadId = leadResult.insertId;
  console.log(`✅ Test lead created with ID: ${leadId}`);

  // Helper to add a missed reminder
  const addMissedReminder = async (offsetMin) => {
    const d = new Date(Date.now() - offsetMin * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = d.toTimeString().slice(0, 8);
    return await queryAsync(
      `INSERT INTO lead_reminders (lead_id, lead_type, reminder_date, reminder_time, reminder_notes, status, missed_count, employee_id)
       VALUES (?, 'telecall', ?, ?, 'NEW_LOGIC_TEST', 'Missed', 1, 1)`,
      [leadId, dateStr, timeStr]
    );
  };

  // 1. Insert 3 missed reminders
  console.log("\n--- STEP 1: Inserting 3 missed reminders ---");
  await addMissedReminder(30);
  await addMissedReminder(20);
  await addMissedReminder(10);

  mockEmits.length = 0;
  console.log("Running runCheckMissed()...");
  await new Promise(r => { runCheckMissed(); setTimeout(r, 1000); });

  // Verify reminders marked notification_sent = 2
  const reminders1 = await queryAsync("SELECT id, status, notification_sent FROM lead_reminders WHERE lead_id = ?", [leadId]);
  console.log("Reminders state:", reminders1);
  const allNotified2 = reminders1.every(r => r.notification_sent === 2);
  console.log(`Are all 3 reminders marked as notification_sent = 2? ${allNotified2 ? "YES" : "NO"}`);
  
  const leadEmits1 = mockEmits.filter(e => e.data?.leadId === leadId);
  console.log(`Mock notifications emitted for our lead: ${leadEmits1.length}`);

  if (!allNotified2 || leadEmits1.length !== 2) {
    console.error("❌ Test failed at Step 1");
    process.exit(1);
  }

  // 2. Run check missed again (should do nothing, since already notified)
  console.log("\n--- STEP 2: Running runCheckMissed() again (should not notify again) ---");
  mockEmits.length = 0;
  await new Promise(r => { runCheckMissed(); setTimeout(r, 1000); });
  const leadEmits2 = mockEmits.filter(e => e.data?.leadId === leadId);
  console.log(`Mock notifications emitted on second run for our lead: ${leadEmits2.length}`);

  if (leadEmits2.length !== 0) {
    console.error("❌ Test failed at Step 2 (duplicate notification)");
    process.exit(1);
  }

  // 3. Add 4th and 5th reminders (should still not escalate yet)
  console.log("\n--- STEP 3: Adding 4th and 5th reminders (total 2 un-notified missed reminders) ---");
  await addMissedReminder(5);
  await addMissedReminder(2);

  mockEmits.length = 0;
  await new Promise(r => { runCheckMissed(); setTimeout(r, 1000); });
  const leadEmits3 = mockEmits.filter(e => e.data?.leadId === leadId);
  console.log(`Mock notifications emitted with 2 new missed for our lead: ${leadEmits3.length}`);

  if (leadEmits3.length !== 0) {
    console.error("❌ Test failed at Step 3 (escalated before reaching 3 missed)");
    process.exit(1);
  }

  // 4. Add 6th reminder (making 3 new missed reminders → should trigger second notification)
  console.log("\n--- STEP 4: Adding 6th reminder (making 3 new missed reminders) ---");
  await addMissedReminder(1);

  mockEmits.length = 0;
  await new Promise(r => { runCheckMissed(); setTimeout(r, 1000); });

  const reminders2 = await queryAsync("SELECT id, status, notification_sent FROM lead_reminders WHERE lead_id = ? ORDER BY id ASC", [leadId]);
  console.log("Reminders state now:", reminders2);
  const allSixNotified2 = reminders2.every(r => r.notification_sent === 2);
  console.log(`Are all 6 reminders marked as notification_sent = 2? ${allSixNotified2 ? "YES" : "NO"}`);
  
  const leadEmits4 = mockEmits.filter(e => e.data?.leadId === leadId);
  console.log(`Mock notifications emitted for our lead: ${leadEmits4.length}`);

  if (!allSixNotified2 || leadEmits4.length !== 2) {
    console.error("❌ Test failed at Step 4");
    process.exit(1);
  }

  // Clean up
  console.log("\n--- STEP 5: Cleaning up test data ---");
  await queryAsync("DELETE FROM lead_reminders WHERE reminder_notes = 'NEW_LOGIC_TEST'");
  await queryAsync("DELETE FROM lead_escalations WHERE customer_name = 'Test Lead New Logic'");
  await queryAsync("DELETE FROM Telecalls WHERE customer_name = 'Test Lead New Logic'");
  console.log("🧹 Cleanup complete.");

  console.log("\n🎉 SUCCESS: All new logic verification checks passed successfully! 🎉");
  db.end();
}

runVerify().catch(err => {
  console.error("❌ Error running verification:", err);
  db.end();
});
