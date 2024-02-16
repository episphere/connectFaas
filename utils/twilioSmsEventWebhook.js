const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const twilio = require("twilio");
const { v4: uuid } = require("uuid");
const { getResponseJSON, createChunkArray, twilioSmsStatusTimeout } = require("./shared");
const { saveNotificationBatch, processTwilioEventWebhook } = require("./firestore")

const recordCommonData = {
    notificationSpecificationsID: uuid(),
    attempt: '1st contact',
    category: 'newsletter',
    token: uuid(),
    uid: uuid(),
    read: false,
  };
let smsRecordArray = [];

smsRecordArray.push({
    ...recordCommonData,
    id: uuid() + "-2",
    notificationType: "sms",
    phone: "+18777804236", // Twilio virtual phone number
    notification: {
        body: "Jessica test twilio sms event webhook 1",
        time: new Date().toISOString(),
    },
});
smsRecordArray.push({
    ...recordCommonData,
    id: uuid() + "-2",
    notificationType: "sms",
    phone: "+18764579754",// Permission to send an SMS or MMS has not been enabled for the region indicated by the 'To' number

    notification: {
        body: "Jessica test twilio sms event webhook 2",
        time: new Date().toISOString(),
    },
});

const _sendSmsBatch = async (smsRecordArray, twilioClient, messagingServiceSid) => {
    let adjustedDataArray = [];
    const chunkArray = createChunkArray(smsRecordArray, 50);
    for (const chunk of chunkArray) {

      const messageArray = await Promise.all(
        chunk.map((smsData) =>
          twilioClient.messages
            .create({
              body: smsData.notification.body,
              to: smsData.phone,
              messagingServiceSid,
            })
            .catch((error) => {
              console.error(`Error sending sms to ${smsData.phone} (token: ${smsData.token}).`, error);
              return { errorOccurred: true };
            })
        )
      );
  
      for (let i = 0; i < chunk.length; i++) {
        if (!messageArray[i].errorOccurred) {
          chunk[i].messageSid = messageArray[i].sid || "";
          chunk[i].error_code = messageArray[i].error_code || "";
          chunk[i].error_message = messageArray[i].error_message || "";
          chunk[i].status = messageArray[i].status || "";
          chunk[i][`${messageArray[i].status}_date`] = new Date().toISOString()

          adjustedDataArray.push(chunk[i]);
        }
      }
    }
  
    return adjustedDataArray;
  };

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

        if (smsRecordArray.length > 0) {
            smsRecordArray = await _sendSmsBatch(smsRecordArray, twilioClient, fetchedSecrets.messagingServiceSid);
            console.log('Data after sending SMS', smsRecordArray)
            await saveNotificationBatch(smsRecordArray);
        }

        console.log("Complete sending email");
        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ code: 500 });
    }
};
const sleep = ms => new Promise(res => setTimeout(res, ms));

/* This function will process the webhook data from Twilio */
const _receivedEvents = async (req, res) => {
    try {
        const status = req.body.MessageStatus;
        // Delay for making sure the twilio event data
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

    if (query.api === "send") {
        await _testSendSms(res);
    } else if (query.api === "receive") {
        await _receivedEvents(req, res);
    } else return res.status(400).json(getResponseJSON("Bad request!", 400));
};

module.exports = {
    twilioSmsEventWebhook,
};
