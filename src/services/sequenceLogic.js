const TIMELINE = [
  { step: 1, delay: 0, type: 'SMS', body: (name, link) => `Hi ${name}, sorry we missed you! I'd love to chat. You can book a time here: ${link}` },
  { step: 2, delay: 0.5, type: 'EMAIL', internal_name: 'followup_email_1' }, // 30 mins
  { step: 3, delay: 24, type: 'SMS', body: (name, link) => `Hey ${name}, just a quick reminder to grab a slot for our session if you're still interested! You can pick a time here: ${link}`},
  { step: 4, delay: 48, type: 'EMAIL', internal_name: 'followup_email_2' },
  { step: 5, delay: 72, type: 'EMAIL', internal_name: 'followup_email_3' }
];

module.exports = {
  getStep(stepNumber) {
    return TIMELINE.find(s => s.step === stepNumber);
  },
  calculateNextStepTime(hours) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (hours * 60));
    return d.toISOString();
  }
};