const Retell = require('retell-sdk');

const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY });
export default retellClient;