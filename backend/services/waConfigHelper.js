const db = require("../config/database");
const wa = require("./whatsappCloudApi");

async function loadUserConfig(userId) {
  if (!userId) return false;
  return new Promise((resolve) => {
    db.query("SELECT * FROM user_wa_configs WHERE user_id = ?", [userId], (err, rows) => {
      if (err || !rows || rows.length === 0) return resolve(false);
      const config = rows[0];
      if (config.is_enabled === 0) return resolve(false);
      resolve(config);
    });
  });
}

async function configureForUser(userId) {
  const config = await loadUserConfig(userId);
  if (!config) return false;
  wa.phoneNumberId = config.phone_number_id;
  wa.accessToken = config.access_token;
  wa.wabaId = config.waba_id || "";
  wa.appSecret = config.app_secret || "";
  wa.verifyToken = config.verify_token || "crm_verify_123";
  wa.businessAccountId = config.business_account_id || "";
  return true;
}

function resetToEnvConfig() {
  wa.phoneNumberId = process.env.WA_PHONE_NUMBER_ID || "";
  wa.accessToken = process.env.WA_ACCESS_TOKEN || "";
  wa.wabaId = process.env.WA_WABA_ID || "";
  wa.appSecret = process.env.WA_APP_SECRET || "";
  wa.verifyToken = process.env.WA_VERIFY_TOKEN || "crm_verify_123";
  wa.businessAccountId = process.env.WA_BUSINESS_ACCOUNT_ID || "";
}

module.exports = { loadUserConfig, configureForUser, resetToEnvConfig };