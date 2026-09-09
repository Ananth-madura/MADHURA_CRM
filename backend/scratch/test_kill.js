const cp = require("child_process");
const path = require("path");
const fs = require("fs");

function killSessionProcesses(sessionDir) {
  if (process.platform !== "win32") return;
  try {
    const escaped = sessionDir.replace(/'/g, "''");
    const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and $_.CommandLine -like '*${escaped}*' } | Select-Object -ExpandProperty ProcessId`;
    const out = cp.execSync(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 10000, encoding: "utf8" });
    const pids = out.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
    console.log(`Found ${pids.length} lingering processes for ${sessionDir}:`, pids);
    for (const pid of pids) {
      try {
        cp.execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
        console.log(`Killed PID ${pid}`);
      } catch (e) {
        console.log(`Failed to kill PID ${pid}:`, e.message);
      }
    }
  } catch (err) {
    console.error("killSessionProcesses error:", err.message);
  }
}

killSessionProcesses("E:\\MADHURA_CRM\\whatsapp-sessions\\708");
