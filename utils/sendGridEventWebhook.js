const sgMail = require("@sendgrid/mail");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { EventWebhook, EventWebhookHeader } = require("@sendgrid/eventwebhook");
const uuid = require('uuid')
const admin = require('firebase-admin');
const db = admin.firestore();
const { processEventWebhook } = require("./firestore");
const { getResponseJSON } = require("./shared");


const _getSecrets = async (envName) => {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: envName
    });
    return version.payload.data.toString();
};

const _testSendEmail = async (res) => {
    console.log("Start sending email");

    try {
        const notificationRecord = {
            notificationSpecificationsID: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            id: uuid(),
            notificationType: 'email',
            email: '', // Update your data to test
            notification: {
              title: 'Test SendGrid Event Webhook',
              body: '<p>Hello World!</p>',
              time: new Date().toISOString(),
            },
            attempt: '3rd contact',
            category: 'sendgrid',
            token: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            uid: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            read: false,
          };
          await db.collection("notifications").add(notificationRecord)

        const apiKey = await _getSecrets(process.env.GCLOUD_SENDGRID_SECRET);
        sgMail.setApiKey(apiKey);

        const msg = {
            personalizations: [
                {
                    to: notificationRecord.email,
                    custom_args: {
                        notification_id: notificationRecord.id,
                        gcloud_project: process.env.GCLOUD_PROJECT,
                    },
                },
            ],
            from: {
                name:
                    process.env.SG_FROM_NAME ||
                    "Connect for Cancer Prevention Study",
                email:
                    process.env.SG_FROM_EMAIL ||
                    "donotreply@myconnect.cancer.gov",
            },
            subject: notificationRecord.notification.title,
            content: [
                {
                    type: "text/html",
                    value: notificationRecord.notification.body,
                },
            ],
            categories: [notificationRecord.category],
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
            const publicKey = await _getSecrets(process.env.GCLOUD_SENDGRID_EVENT_WEBHOOKSECRET);
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
