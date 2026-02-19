const hubspot = require('@hubspot/api-client');
const config = require('../config');
const client = new hubspot.Client({ accessToken: config.hubspotToken });

module.exports = {
 async getContactsToCall() {
  try {
    const LIST_ID = '103';

    const listResponse = await client.crm.lists.membershipsApi.getPage(
      LIST_ID,
      undefined,
      100
    );

    const contactIds = listResponse.results.map(contact => contact.recordId);

    if (!contactIds.length) return [];

    const batchResponse = await client.crm.contacts.batchApi.read({
      inputs: contactIds.map(id => ({ id: id.toString() })),
      properties: [
        'firstname',
        'phone',
        'ai_outreach_status',
        'ai_next_attempt_time',
        'ai_attempt_count'
      ]
    });

    const now = new Date();

    return batchResponse.results.filter(contact => {
      const props = contact.properties;
      const status = props.ai_outreach_status;
      const nextAttempt = props.ai_next_attempt_time
        ? new Date(props.ai_next_attempt_time)
        : null;

      const isPending = status === 'Pending';
      const isTimeToDo = !nextAttempt || nextAttempt <= now;
      const hasPhone = !!props.phone;

      return isPending && isTimeToDo && hasPhone;
    });

  } catch (error) {
    console.error(
      'HubSpot Service Error:',
      error.response?.body || error.message
    );
    return [];
  }

  },

  async updateContact(contactId, properties) {
    try {
      return await client.crm.contacts.basicApi.update(contactId, { properties });
    } catch (error) {
      console.error(`Update Error for Contact ${contactId}:`, error.response?.body || error.message);
    }
  }
};