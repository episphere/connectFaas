const { getResponseJSON } = require("./shared");
const sgMail = require("@sendgrid/mail");

const uuid = require("uuid");

// Update data to test
const notificationRecord = {
    notificationSpecificationsID: "",
    id: uuid(),
    notificationType: "email",
    email: "",
    notification: {
        title: "Test SendGrid Event Webhook",
        body: "<p>Hello World!</p>",
        time: new Date().toISOString(),
    },
    attempt: "1st contact",
    category: "Notification Testing Email",
    token: "",
    uid: "",
    read: false,
};

const _testSendEmail = async (res) => {
    console.log("Start sending email");
    // Add SendGrid apiKey to test
    sgMail.setApiKey("");

    // Update data to test
    const msg = {
        personalizations: [
            {
                to: "",
                custom_args: {
                    connect_id: "",
                    token: notificationRecord.token,
                    notification_id: notificationRecord.id,
                    attempt: "1",
                },
            },
            {
                to: "",
                custom_args: {
                    connect_id: "",
                    token: notificationRecord.token,
                    notification_id: notificationRecord.id,
                    attempt: "1",
                },
            },
        ],
        from: {
            name:
                process.env.SG_FROM_NAME ||
                "Connect for Cancer Prevention Study",
            email:
                process.env.SG_FROM_EMAIL || "donotreply@myconnect.cancer.gov",
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

    sgMail
        .send(msg)
        .then(async () => {
            console.log("Complete sending email");

            await db.collection("notifications").add(notificationRecord);
            return res.status(200).json({ code: 200 });
        })
        .catch((error) => {
            console.error(error);
            return res.status(500).json({ code: 500 });
        });
};

const _receivedEvents = async (req, res) => {
    const events = req.body;
    for (let event of events) {
        await processEventWebhook(event);
    }
    return res.status(200).json({ code: 200 });
};

const sendGridEventWebhook = async (req, res) => {
    if (req.method !== "POST") {
        return res
            .status(405)
            .json(getResponseJSON("Only POST requests are accepted!", 405));
    }
    const query = req.query;

    if (query.api === "send") {
        _testSendEmail(res);
    } else if (query.api === "receive") {
        await _receivedEvents(req, res);
    } else return res.status(400).json(getResponseJSON("Bad request!", 400));
};

module.exports = {
    sendGridEventWebhook,
};
