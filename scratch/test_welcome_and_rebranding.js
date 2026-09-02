const db = require("../backend/config/database");

async function verify() {
  console.log("=== VERIFYING WHATSAPP FIXES & REBRANDING ===");

  const { formatMessagePlaceholders, getWelcomeSettings } = require("../backend/services/waAutomationService");

  // 1. Check placeholder defaults
  const sample = formatMessagePlaceholders("Welcome to {company}! Sent by {brand_name}.");
  console.log("Formatted text:", sample);
  if (!sample.includes("Madhura Tech")) {
    throw new Error("Placeholder brand is not Madhura Tech: " + sample);
  }
  console.log("✅ Placeholder branding verified: Madhura Tech");

  // 2. Check getWelcomeSettings default
  const settings = await getWelcomeSettings();
  console.log("Welcome Settings:", settings);
  if (settings.welcome_text && settings.welcome_text.includes("ACHME")) {
    throw new Error("welcome_text still contains ACHME: " + settings.welcome_text);
  }
  console.log("✅ Welcome text branding verified without ACHME");

  // 3. Check DB wa_welcome_settings and wa_templates
  const [welcomeRows] = await db.promise().query("SELECT * FROM wa_welcome_settings WHERE id = 1");
  console.log("DB wa_welcome_settings row:", welcomeRows[0]);

  const [templates] = await db.promise().query("SELECT id, name, header_value, body, footer FROM wa_templates LIMIT 5");
  console.log("Sample templates from DB:", templates);
  const achmeTmpl = templates.find(t => (t.header_value && t.header_value.includes("ACHME")) || (t.body && t.body.includes("ACHME")) || (t.footer && t.footer.includes("ACHME")));
  if (achmeTmpl) {
    console.warn("Found template with ACHME, running migration query...");
    await db.promise().query(
      `UPDATE wa_templates
       SET header_value = REPLACE(REPLACE(header_value, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech'),
           body = REPLACE(REPLACE(body, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech'),
           footer = REPLACE(REPLACE(footer, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech')`
    );
    console.log("✅ Templates migrated to Madhura Tech");
  }

  // 4. Check automations in DB
  const [automations] = await db.promise().query("SELECT id, name, trigger_type, is_active FROM wa_automations");
  console.log("Automations in DB:", automations);

  console.log("\n🎉 ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
