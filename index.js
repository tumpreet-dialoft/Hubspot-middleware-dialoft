const express = require("express");
const cron = require("node-cron");
const Retell = require("retell-sdk");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./src/config");
const hubspotService = require("./src/services/hubspotService");
const retryLogic = require("./src/services/retryLogic");
const smsService = require("./src/services/smsService");
const sequenceLogic = require("./src/services/sequenceLogic");
const zapierService = require("./src/services/zapierService");

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 100, // 100 requests per minute per IP
});

const app = express();
app.set("trust proxy", 1);

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

      // Logic for lead_source mapping
      const hsStatus = contact.properties.hs_lead_status;
      let determinedLeadSource = "META_AD"; // Default value

      if (hsStatus === "ATTEMPTED_TO_CONTACT" || hsStatus === "BAD_TIMING") {
        determinedLeadSource = "HUBSPOT_WARM";
      }

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
            lead_source: determinedLeadSource,
            Email: contact.properties.email,
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

        console.log(
          `Call Initiated: ${call.call_id} Lead Source: ${determinedLeadSource}`,
        );
      } catch (callError) {
        console.error(
          `Retell API failed for contact ${contact.id}:`,
          callError.message,
        );
      }
    }

    // ===============================
    // 2️⃣ NEW FOLLOW-UP SEQUENCE ENGINE
    // ===============================

    const followupContacts = await hubspotService.getContactsForFollowup();
    console.log(
      `Found ${followupContacts.length} contacts in Follow-Up Sequence.`,
    );

    for (const contact of followupContacts) {
      try {
        const stepNum = parseInt(contact.properties.ai_followup_step || 1);
        const step = sequenceLogic.getStep(stepNum);

        if (!step) continue;

        const { firstname, email, phone } = contact.properties;
        const bookingLink = `${process.env.CAL_BOOKING_URL}?name=${encodeURIComponent(firstname)}&email=${encodeURIComponent(email)}&utm_source=followup_step${stepNum}`;

        // --- EXECUTE STEP ---
        if (step.type === "SMS") {
          await smsService.sendSMS(
            contact.properties.phone,
            step.body(firstname, bookingLink),
          );
        } else if (step.type === "EMAIL") {
          await zapierService.triggerZapierEmail(
            email,
            firstname,
            stepNum,
            bookingLink,
          );
        }

        // --- SCHEDULE NEXT STEP ---
        // --- SCHEDULE NEXT STEP ---
        const MAX_STEP = 5;
        const currentStepNum = Number(stepNum);

        if (currentStepNum >= MAX_STEP) {
          await hubspotService.updateContact(contact.id, {
            enroll_in_sequance: "sequence_complete_no_booking",
            ai_outreach_status: "Hard Stop",
          });
          return;
        }

        const nextStepNum = currentStepNum + 1;
        const nextStep = sequenceLogic.getStep(nextStepNum);

        if (nextStep) {
          await hubspotService.updateContact(contact.id, {
            ai_followup_step: nextStepNum.toString(),
            ai_next_followup_time: sequenceLogic.calculateNextStepTime(
              nextStep.delay,
            ),
          });
        }
      } catch (followError) {
        console.error(
          `Follow-up processing failed for contact ${contact.id}:`,
          followError.message,
        );
      }
    }
  } catch (error) {
    console.error("General Poller Error:", error.message);
  }
  console.log("--- Poller Cycle End ---");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.post("/cal-webhook", async (req, res) => {
  try {
    const { payload } = req.body;

    if (!payload?.attendees?.length) {
      console.log("No attendees found");
      return res.sendStatus(200);
    }

    const email = payload.attendees[0].email;

    const contact = await hubspotService.findContactByEmail(email);

    if (contact) {
      await hubspotService.updateContact(contact.id, {
        ai_outreach_status: "Hard Stop",
        ai_call_outcome: "Interested",
      });

      console.log(`Booking confirmed for ${email}. Stopped AI outreach.`);
    } else {
      console.log(`No HubSpot contact found for ${email}`);
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }

  res.sendStatus(200);
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

    const ai_call_booking_time =
      call?.call_analysis?.custom_analysis_data?.ai_call_booking_time || null;

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
