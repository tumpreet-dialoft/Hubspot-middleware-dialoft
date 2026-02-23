const axios = require('axios');

module.exports = {
  async triggerZapierEmail(email, firstName, stepNumber, bookingLink) {
    const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_FOLLOWUP_WEBHOOK;

    try {
      await axios.post(ZAPIER_WEBHOOK_URL, {
        email: email,
        firstName: firstName,
        step: stepNumber,
        bookingLink: bookingLink,
        type: 'FOLLOW_UP_EMAIL'
      });
      console.log(`Zapier trigger sent for Step ${stepNumber} to ${email}`);
    } catch (error) {
      console.error('Zapier Webhook Error:', error.message);
    }
  }
};