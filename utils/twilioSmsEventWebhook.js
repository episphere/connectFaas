const sgMail = require("@sendgrid/mail");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { EventWebhook, EventWebhookHeader } = require("@sendgrid/eventwebhook");
const { processEventWebhook } = require("./firestore");
const { getResponseJSON } = require("./shared");
const twilio = require("twilio");

const _testSendSms = async (res) => {
    console.log("Start sending SMS");

    try {
        const secretsToFetch = {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        };
        const client = new SecretManagerServiceClient();
        let fetchedSecrets = {};
        for (const [key, value] of Object.entries(secretsToFetch)) {
            const [version] = await client.accessSecretVersion({ name: value });
            fetchedSecrets[key] = version.payload.data.toString();
        }

        const twilioClient = twilio(
            fetchedSecrets.accountSid,
            fetchedSecrets.authToken
        );
            console.log('fetchedSecrets.messagingServiceSid', fetchedSecrets.messagingServiceSid)
        const response = await twilioClient.messages
          .create({
            body: 'Hello world',
            to: '+18777804236',
            messagingServiceSid: fetchedSecrets.messagingServiceSid,
          })
        

        console.log("Complete sending email", response);
        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ code: 500 });
    }
};

// const _receivedEvents = async (req, res) => {
//     try {
//         const events = req.body;
//         for (let event of events) {
//             await processEventWebhook(event);
//         }
//         return res.status(200).json({ code: 200 });
//     } catch (e) {
//         console.error(e);
//         return res.status(500).json({ code: 500 });
//     }
// };

const _getSecrets = async () => {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: process.env.GCLOUD_SENDGRID_EVENT_WEBHOOKSECRET,
    });
    return version.payload.data.toString();
};

const twilioSmsEventWebhook = async (req, res) => {
    try {
        if (req.method !== "POST") {
            return res
                .status(405)
                .json(getResponseJSON("Only POST requests are accepted!", 405));
        }
        const query = req.query;

        if (query.api === "send") {
            await _testSendSms(res);
        } else if (query.api === "message-status") {
            const messageSid = req.body.MessageSid;
            const messageStatus = req.body.MessageStatus;

            console.log(`SID: ${messageSid}, Status: ${messageStatus}`);
            console.log(`req.body`, req.body);

            return res.status(200).json({ code: 200 });
        } else
            return res.status(400).json(getResponseJSON("Bad request!", 400));
    } catch (error) {
        console.error("twilioSmsEventWebhook error", error);
        return res
            .status(500)
            .json(getResponseJSON("Internal Server Error!", 500));
    }
};

module.exports = {
    twilioSmsEventWebhook,
};
