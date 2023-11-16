const sgMail = require("@sendgrid/mail");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { EventWebhook, EventWebhookHeader } = require("@sendgrid/eventwebhook");
const { processEventWebhook } = require("./firestore");
const { getResponseJSON } = require("./shared");

const _testSendEmail = async (res) => {
    console.log("Start sending email");

    try {
        // Add SendGrid apiKey to test
        sgMail.setApiKey("");

        // Update data to test
        const msg = {
            personalizations: [
                {
                    to: "",
                    custom_args: {
                        connect_id: "cnid1",
                        token: "tk1",
                        notification_id: "nid1",
                        gcloud_project: process.env.GCLOUD_PROJECT,
                        attempt: "1",
                    },
                },
                // {
                //     to: "",
                //     custom_args: {
                //         connect_id: "cnid2",
                //         token: "tk2",
                //         notification_id: "nid2",
                //         gcloud_project: process.env.GCLOUD_PROJECT,
                //         attempt: "1",
                //     },
                // },
            ],
            from: {
                name:
                    process.env.SG_FROM_NAME ||
                    "Connect for Cancer Prevention Study",
                email:
                    process.env.SG_FROM_EMAIL ||
                    "donotreply@myconnect.cancer.gov",
            },
            subject: "Test SendGrid Event Webhook",
            content: [
                {
                    type: "text/html",
                    value: "<p>Hello World!</p>",
                },
            ],
            categories: ["Test"],
        };
        await sgMail.send(msg);
        console.log("Complete sending email");
        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ code: 500 });
    }
};

const _receivedEvents = async (req, res) => {
    try {
        const events = req.body;
        for (let event of events) {
            await processEventWebhook(event);
        }
        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ code: 500 });
    }
};

const _getSecrets = async () => {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: process.env.GCLOUD_SENDGRID_EVENT_WEBHOOKSECRET,
    });
    return version.payload.data.toString();
};

const sendGridEventWebhook = async (req, res) => {
    try {
        if (req.method !== "POST") {
            return res
                .status(405)
                .json(getResponseJSON("Only POST requests are accepted!", 405));
        }
        const query = req.query;

        if (query.api === "send") {
            await _testSendEmail(res);
        } else if (query.api === "receive") {
            const publicKey = await _getSecrets();
            const eventWebhook = new EventWebhook();
            const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey);
            const payload = req.rawBody;
            const signature = req.get(EventWebhookHeader.SIGNATURE());
            const timestamp = req.get(EventWebhookHeader.TIMESTAMP());

            const verification = eventWebhook.verifySignature(
                ecPublicKey,
                payload,
                signature,
                timestamp
            );

            if (verification) {
                await _receivedEvents(req, res);
            } else {
                res.status(403).send("Forbidden");
            }
        } else return res.status(400).json(getResponseJSON("Bad request!", 400));

    } catch (error) {
        console.error('sendGridEventWebhook error', error);
        return res.status(500).json(getResponseJSON("Internal Server Error!", 500));
    }

};

module.exports = {
    sendGridEventWebhook,
};
