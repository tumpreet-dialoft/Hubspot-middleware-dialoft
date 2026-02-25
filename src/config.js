require('dotenv').config();

module.exports = {
  hubspotToken: process.env.HUBSPOT_ACCESS_TOKEN,
  retellApiKey: process.env.RETELL_API_KEY,
  agentId: process.env.RETELL_AGENT_ID,
  fromNumber: process.env.RETELL_FROM_NUMBER,
  port: process.env.PORT || 3000,
  twilioSid: process.env.TWILIO_SID,
  twilioAuthToken :process.env.TWILIO_AUTH_TOKEN
};