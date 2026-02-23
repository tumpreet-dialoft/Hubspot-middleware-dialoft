const hubspot = require("@hubspot/api-client");
const config = require("../config");
const client = new hubspot.Client({ accessToken: config.hubspotToken });

module.exports = {
  async getContactsToCall() {
    try {
      const LIST_ID = "133";

      const listResponse = await client.crm.lists.membershipsApi.getPage(
        LIST_ID,
        undefined,
        100,
      );

      const contactIds = listResponse.results.map(
        (contact) => contact.recordId,
      );

      if (!contactIds.length) return [];

      const batchResponse = await client.crm.contacts.batchApi.read({
        inputs: contactIds.map((id) => ({ id: id.toString() })),
        properties: [
          "firstname",
          "phone",
          "email",
          "ai_outreach_status",
          "ai_next_attempt_time",
          "ai_attempt_count",
          "hs_lead_status",
        ],
      });

      const now = new Date();

      return batchResponse.results.filter((contact) => {
        const props = contact.properties;
        const status = props.ai_outreach_status;
        const nextAttempt = props.ai_next_attempt_time
          ? new Date(props.ai_next_attempt_time)
          : null;

        const isPending = status === "Pending";
        const isTimeToDo = !nextAttempt || nextAttempt <= now;
        const hasPhone = !!props.phone;

        return isPending && isTimeToDo && hasPhone;
      });
    } catch (error) {
      console.error(
        "HubSpot Service Error:",
        error.response?.body || error.message,
      );
      return [];
    }
  },

  /**
   * 2. GET CONTACTS FOR FOLLOW-UP SEQUENCE (Search API Based)
   * This looks for people in the 72h sequence who are due for an SMS/Email
   */
  async getContactsForFollowup() {
    try {
      const now = new Date().toISOString();

      const publicObjectSearchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "ai_outreach_status",
                operator: "EQ",
                value: "Pending",
              },
              
              {
                propertyName: "ai_next_followup_time",
                operator: "LT", // Less than Now
                value: now,
              },
            ],
          },
        ],
        properties: [
          "firstname",
          "email",
          "phone",
          "ai_followup_step",
          "ai_next_followup_time",
          "ai_sequence_enrolled_at",
          "hs_lead_status",
        ],
        limit: 100,
      };

      const searchResponse = await client.crm.contacts.searchApi.doSearch(
        publicObjectSearchRequest,
      );

      return searchResponse.results;
    } catch (error) {
      console.error(
        "HubSpot getContactsForFollowup Error:",
        error.response?.body || error.message,
      );
      return [];
    }
  },

  async findContactByEmail(email) {
    try {
      const searchRequest = {
        filterGroups: [
          {
            filters: [{ propertyName: "email", operator: "EQ", value: email }],
          },
        ],
        limit: 1,
      };
      const response =
        await client.crm.contacts.searchApi.doSearch(searchRequest);
      return response.results[0] || null;
    } catch (e) {
      console.error("Find by email error:", e.message);
      return null;
    }
  },

  async updateContact(contactId, properties) {
    try {
      return await client.crm.contacts.basicApi.update(contactId, {
        properties,
      });
    } catch (error) {
      console.error(
        `Update Error for Contact ${contactId}:`,
        error.response?.body || error.message,
      );
    }
  },
};
