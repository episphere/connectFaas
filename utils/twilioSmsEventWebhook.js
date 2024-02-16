const { getResponseJSON, twilioSmsStatusTimeout } = require("./shared");
const { processTwilioEventWebhook } = require("./firestore");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* This function will process the webhook data from Twilio */
const receivedEvents = async (req, res) => {
    try {
        const status = req.body.MessageStatus;
        // Delay to ensure twilio webhook event data returns in the correct order and ensure all messages have been sent and saved to the database
        await sleep(twilioSmsStatusTimeout[status]);
        await processTwilioEventWebhook(req.body);

        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error("twilioSmsEventWebhook error", e);
        return res
            .status(500)
            .json(getResponseJSON("Internal Server Error!", 500));
    }
};

const twilioSmsEventWebhook = async (req, res) => {
    if (req.method !== "POST") {
        return res
            .status(405)
            .json(getResponseJSON("Only POST requests are accepted!", 405));
    }
    const query = req.query;

    if (query.api === "message-status") {
        await receivedEvents(req, res);
    } else return res.status(400).json(getResponseJSON("Bad request!", 400));
};

module.exports = {
    twilioSmsEventWebhook,
};
