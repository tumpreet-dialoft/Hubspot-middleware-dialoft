const axios = require('axios');
const config = require('../config');

const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_VERSION = "2024-08-13"; // Current stable V2 version

const calClient = axios.create({
  baseURL: 'https://api.cal.com/v2',
  headers: {
    'Authorization': `Bearer ${CAL_API_KEY}`,
    'cal-api-version': CAL_VERSION,
    'Content-Type': 'application/json'
  }
});

module.exports = {
  async bookMeetingV2(data) {
    try {
      const response = await calClient.post('/bookings', {
        start: data.startTime, // Must be ISO 8601 UTC
        eventTypeId: parseInt(data.eventTypeId),
        attendee: {
          name: data.name,
          email: data.email,
          timeZone: data.timeZone || "UTC",
          language: "en"
        },
        // Optional: pass HubSpot ID to Cal.com for tracking
        metadata: { hubspot_id: data.contactId }
      });

      return { success: true, booking: response.data.data };
    } catch (error) {
      const errorData = error.response?.data;
      
      // Specific check for unavailable slots (API V2 error patterns)
      if (error.response?.status === 400 || error.response?.status === 409) {
        const message = errorData?.error?.message || "";
        if (message.includes("available") || message.includes("busy")) {
          return { success: false, errorType: "SLOT_TAKEN", message: "This slot is no longer available." };
        }
      }

      console.error('Cal.com V2 Error:', errorData || error.message);
      return { success: false, errorType: "GENERAL_ERROR", message: "System error during booking." };
    }
  }
};