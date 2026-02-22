const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  async sendFollowupEmail(to, firstName, stepNumber, bookingLink) {
    const templates = {
      2: {
        subject: `Quick follow-up / ${firstName}`,
        html: `<p>Hi ${firstName},</p><p>I tried calling earlier but couldn't reach you. I wanted to personally follow up regarding our strategy session.</p><p>You can pick a time that works for you here: <a href="${bookingLink}">Book Meeting</a></p><p>Best,<br>The AI Team</p>`
      },
      4: {
        subject: `Value & Proof for ${firstName}`,
        html: `<p>Hi ${firstName}, just sharing some results from our recent partners. We'd love to help you achieve the same. Is there a better time to chat?</p><p><a href="${bookingLink}">See my calendar here.</a></p>`
      },
      5: {
        subject: `One last try`,
        html: `<p>Hi ${firstName}, I haven't heard back, so I'll assume now isn't the best time. I'll take you off our active list for now.</p><p>If you change your mind, my link is always open: <a href="${bookingLink}">Booking Link</a></p>`
      }
    };

    const template = templates[stepNumber];

    try {
      await resend.emails.send({
        from: 'Onboarding <hello@yourdomain.com>', // Must be a domain you own
        to: [to],
        subject: template.subject,
        html: template.html,
      });
      console.log(`Email Step ${stepNumber} sent to ${to}`);
    } catch (error) {
      console.error('Resend Error:', error);
    }
  }
};