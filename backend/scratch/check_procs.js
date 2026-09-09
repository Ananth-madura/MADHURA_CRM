const cp = require("child_process");
const fs = require("fs");

try {
  const output = cp.execSync("wmic process get ProcessId,CommandLine /format:csv", { maxBuffer: 10 * 1024 * 1024 }).toString();
  const lines = output.split("\n").filter(line => line.includes("whatsapp-sessions"));
  console.log(`Found ${lines.length} processes using whatsapp-sessions:`);
  lines.forEach(l => console.log(l.trim()));
} catch (e) {
  console.error("Error:", e.message);
}
