const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = {
  async sendSMS(to, body) {
    try {
      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });
      return message.sid;
    } catch (error) {
      console.error('Twilio Error:', error.message);
    }
  }
};