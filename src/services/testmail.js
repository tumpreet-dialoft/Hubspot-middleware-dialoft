
const { sendSMS } = require('./smsService')



//sendFollowupEmail('tumpreet@dialoftai.com', 'tumpreet', 2, 'https://cal.com/romanlbinder/ai-discovery-call');
sendSMS('+916280505657', 'Hi ${name}, sorry we missed you! Id love to chat. You can book a time here: [LINK]' );