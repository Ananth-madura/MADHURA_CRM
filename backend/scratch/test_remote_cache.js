const fetch = require("node-fetch");

async function checkRemoteVersions() {
  const versions = [
    "2.3000.1017054665",
    "2.3000.1014524416",
    "2.3000.1014111620",
    "2.3000.1013444004"
  ];
  for (const v of versions) {
    const url = `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${v}.html`;
    try {
      const res = await fetch(url);
      console.log(v, "status:", res.status, "ok:", res.ok);
    } catch (e) {
      console.log(v, "error:", e.message);
    }
  }
  process.exit(0);
}

checkRemoteVersions();
