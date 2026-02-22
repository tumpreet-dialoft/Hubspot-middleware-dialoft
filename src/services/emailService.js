const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  async sendFollowupEmail(to, firstName, stepNumber, bookingLink) {
    const templates = {
      2: {
        subject: `I just tried calling you / ${firstName}`,
        html: ` <p>Hey ${firstName},</p>
      <br>
      <p>I just tried giving you a call about your request — sorry I missed you!</p>
      <br>
      <p>I wanted to personally reach out because we've been helping founders like you book 20+ qualified sales calls per month using AI-powered outreach systems.</p>
      <br>
      <p>If that sounds interesting, grab a quick 15-min slot and I'll walk you through exactly how it works:</p>
      <br>
      <p><a class="cta" href="${bookingLink}">📅 Book Your Strategy Call</a></p>
      <br>
      <p>Talk soon,<br>Roman</p>`,
      },
      4: {
        subject: `This is how founders are booking 20+ calls/month ${firstName}`,
        html: `<p>Hey ${firstName},</p>
      <br>
      <p>Following up — I know things get busy, so I'll keep this short.</p>
      <br>
      <p>We recently helped a B2B founder go from 3 calls/month to 22 qualified sales calls using our AI-powered outreach system. No cold calling. No spam. Just smart, targeted conversations with decision-makers.</p>
      <br>
      <p>Here's what made the difference:</p>
      <p>• AI agents that qualify and engage leads 24/7</p>
      <p>• Multi-channel sequences (calls, SMS, email) that actually convert</p>
      <p>• A system that scales without adding headcount</p>
      <br>
      <p>If you're serious about scaling revenue without scaling complexity, this is worth 15 minutes of your time:</p>
      <br>
      <p><a class="cta" href="${bookingLink}">📅 Grab Your Free Strategy Session</a></p>
      <br>
      <p>Best,<br>Roman</p>`,
      },
      5: {
        subject: `Should I close your file, ${firstName}?`,
        html: ` <p>Hey ${firstName},</p>
      <br>
      <p>I've reached out a few times now and haven't heard back, so I want to respect your time.</p>
      <br>
      <p>If growing your pipeline with qualified sales calls isn't a priority right now, no worries at all — I'll close out your file.</p>
      <br>
      <p>But if you've just been busy and this is still on your radar, here's your last chance to grab a free strategy session:</p>
      <br>
      <p><a class="cta" href="${bookingLink}">📅 Book Before I Close Your File</a></p>
      <br>
      <p>Either way, I wish you nothing but success.</p>
      <br>
      <p>Cheers,<br>Roman</p>`,
      },
    };

    const template = templates[stepNumber];

    try {
      await resend.emails.send({
        from: "Onboarding <hello@yourdomain.com>", // Must be a domain you own
        to: [to],
        subject: template.subject,
        html: template.html,
      });
      console.log(`Email Step ${stepNumber} sent to ${to}`);
    } catch (error) {
      console.error("Resend Error:", error);
    }
  },
};
