const mgr = require("../services/whatsappService");

async function test() {
  console.log("Default key:", mgr.defaultKey);
  const session = mgr.get("708");
  console.log("Session 708 status:", await session.getStatus());
  process.exit(0);
}

test();
