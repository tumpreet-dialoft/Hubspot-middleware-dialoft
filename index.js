const express = require("express");
const cron = require("node-cron");
const Retell = require("retell-sdk");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require("./src/config");
const hubspotService = require("./src/services/hubspotService");
const retryLogic = require("./src/services/retryLogic");


const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 100 // 100 requests per minute per IP
});

const app = express();
app.set('trust proxy', 1);



app.use(express.json());

//Seucurity middleware.
app.use(helmet());
app.use(limiter);



const retellClient = new Retell({ apiKey: config.retellApiKey });

// --- THE POLLER (Runs every 2 minutes) ---
cron.schedule("*/2 * * * *", async () => {
  console.log("--- Poller Cycle Start ---");
  try {
    const contacts = await hubspotService.getContactsToCall();
    console.log(
      `Found ${contacts.length} contacts in Segment List ready for calls.`,
    );

    for (const contact of contacts) {
      const currentAttempt = parseInt(contact.properties.ai_attempt_count || 0);
      const nextAttemptNumber = currentAttempt + 1;

      // Basic Phone Sanitization (Retell needs E.164, e.g., +1...)
      let phone = contact.properties.phone.replace(/\s+/g, "");
      if (!phone.startsWith("+")) phone = `+${phone}`;

      console.log(
        `Attempting Call: ${contact.properties.firstname} at ${phone} (Attempt ${nextAttemptNumber})`,
      );

      try {
        const call = await retellClient.call.createPhoneCall({
          from_number: config.fromNumber,
          to_number: phone,
          agent_id: config.agentId,
          retell_llm_dynamic_variables: {
            FirstName: contact.properties.firstname || "there",
            hubspot_contact_id: contact.id,
            lead_source:"META_AD"
          },
          metadata: {
            hubspot_contact_id: contact.id,
            attempt_number: nextAttemptNumber,
          },
        });

        // Immediately update HubSpot so we don't call them again in the next 2-minute cycle
        await hubspotService.updateContact(contact.id, {
          ai_outreach_status: "Calling",
          ai_attempt_count: nextAttemptNumber.toString(),
        });

        console.log(`Call Initiated: ${call.call_id}`);
      } catch (callError) {
        console.error(
          `Retell API failed for contact ${contact.id}:`,
          callError.message,
        );
      }
    }
  } catch (error) {
    console.error("General Poller Error:", error.message);
  }
  console.log("--- Poller Cycle End ---");
});

// --- RETELL WEBHOOK ---

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.post("/retell-webhook", async (req, res) => {
  try {
    const { event, call } = req.body;

    // Always acknowledge unknown events
    if (!event || !call) {
      console.log("Invalid webhook payload received.");
      return res.sendStatus(200);
    }

    // Only process analyzed events
    if (event !== "call_analyzed") {
      return res.sendStatus(200);
    }

    // Safely extract metadata
    const contactId = call?.metadata?.hubspot_contact_id;
    const attempt = Number(call?.metadata?.attempt_number || 0);

    if (!contactId) {
      console.log("Webhook missing hubspot_contact_id. Skipping.");
      return res.sendStatus(200);
    }

    const sentiment =
      call?.call_analysis?.custom_analysis_data?.ai_call_outcome ||
      "No Outcome";

    const summary = call?.call_analysis?.call_summary || "No summary provided";

    const recordingUrl = call?.recording_url || "";

    const ai_call_booking_time = call?.call_analysis?.custom_analysis_data?.ai_call_booking_time || null;

    

    

    // DO NOT convert — already correct German ISO format
    const bookingTime = ai_call_booking_time || null;

    console.log(
      `Webhook Received: Contact ${contactId}, Attempt ${attempt}, Outcome: ${sentiment}`,
    );

    let nextStatus = "Pending";
    let nextTime = retryLogic.calculateNextTime(attempt);
    
    

    // Hard stop or retry exhaustion logic
    if (retryLogic.isHardStop(sentiment) || !nextTime) {
      nextStatus = retryLogic.isHardStop(sentiment) ? "Hard Stop" : "Completed";

      nextTime = "";
    }

    // Update HubSpot safely
    try {
      await hubspotService.updateContact(contactId, {
        ai_outreach_status: nextStatus,
        ai_next_attempt_time: nextTime,
        ai_call_outcome: sentiment,
        ai_call_summary: summary,
        ai_recording_url: recordingUrl,
        ai_call_booking_time: bookingTime, 

      });
    } catch (hubspotError) {
      console.error(
        `HubSpot update failed for ${contactId}:`,
        hubspotError.response?.body || hubspotError.message,
      );
      // Do NOT throw — still return 200
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Always return 200 to prevent retry storms
    res.sendStatus(200);
  }
});

app.listen(config.port, () =>
  console.log(`Middleware running on port ${config.port}`),
);
