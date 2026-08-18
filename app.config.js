const { expo } = require("./app.json");

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    agoraAppId: process.env.EXPO_PUBLIC_AGORA_APP_ID || "",
    agoraTempToken: process.env.EXPO_PUBLIC_AGORA_TEMP_TOKEN || "",
  },
});
