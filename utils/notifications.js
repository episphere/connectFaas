const { v4: uuid } = require("uuid");
const sgMail = require("@sendgrid/mail");
const showdown = require("showdown");
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const {getResponseJSON, setHeadersDomainRestricted, setHeaders, logIPAdddress, redactEmailLoginInfo, redactPhoneLoginInfo, createChunkArray, validEmailFormat} = require("./shared");
const {getScheduledNotifications, saveNotificationBatch} = require("./firestore");
const {getParticipantsForNotificationsBQ} = require("./bigquery");
const conceptIds = require("./fieldToConceptIdMapping");
let twilioClient, messagingServiceSid;

(async () => {
  [twilioClient, messagingServiceSid] = await setupTwilioSms();
})();

async function setupTwilioSms() {
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

  const twilioClient = require("twilio")(fetchedSecrets.accountSid, fetchedSecrets.authToken);
  return [twilioClient, fetchedSecrets.messagingServiceSid];
}

const sendSmsBatch = async (smsRecordArray) => {
  // TODO: further check to see whether 1000 is a good batch size
  let adjustedDataArray = [];
  const chunkArray = createChunkArray(smsRecordArray, 1000);
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
        adjustedDataArray.push(chunk[i]);
      }
    }
  }

  return adjustedDataArray;
};

const subscribeToNotification = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    const decodedToken = await validateIDToken(idToken);

    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }

    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    const data = req.body;
    console.log(decodedToken.uid , JSON.stringify(data));
    if(Object.keys(data).length <= 0 && data.token === undefined){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    const notificationToken = data.token;

    const { notificationTokenExists } = require('./firestore');
    const { storeNotificationTokens } = require('./firestore');
    const uid = await notificationTokenExists(notificationToken);
    if(uid && uid !== decodedToken.uid) return res.status(403).json(getResponseJSON('Token is already associated with another user', 403))
    if(uid) return res.status(400).json(getResponseJSON('Token already exists', 400));
    storeNotificationTokens({notificationToken, uid: decodedToken.uid})
    res.status(200).json({message: 'Success!', code:200})
}

const markAllNotificationsAsAlreadyRead = (notification, collection) => {
    for(let id of notification) {
        if(id) {
            const {markNotificationAsRead} = require('./firestore');
            markNotificationAsRead(id, collection);
        }
    }
}

const retrieveNotifications = async (req, res, uid) => {

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { retrieveUserNotifications } = require('./firestore');
    const notifications = await retrieveUserNotifications(uid);
    if(notifications !== false){
        markAllNotificationsAsAlreadyRead(notifications.map(dt => dt.id), 'notifications');
    }
    res.status(200).json({data: notifications === false ? [] : notifications, code:200})
}

const getSecrets = async () => {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: process.env.GCLOUD_SENDGRID_SECRET,
    });
    const payload = version.payload.data.toString();
    return payload;
}

const sendEmail = async (emailTo, messageSubject, html, cc) => {
    const sgMail = require('@sendgrid/mail');
    const apiKey = await getSecrets();
    sgMail.setApiKey(apiKey);
    const msg = {
        to: emailTo,
        from: {
            name: process.env.SG_FROM_NAME || 'Connect for Cancer Prevention Study',
            email: process.env.SG_FROM_EMAIL || 'donotreply@myconnect.cancer.gov'
        },
        subject: messageSubject,
        html: html,
    };
    if(cc) msg.cc = cc;
    sgMail.send(msg).then(() => {
        console.log('Email sent to '+emailTo)
    })
    .catch((error) => {
        console.error(error)
    });
}

/**
 * Function triggered by Pub/Sub topic, accepting a message containing a string.
 * @param {Object} message Pub/Sub message object.
 * @param {string} message.data base64-encoded string.
 */
async function notificationHandler(message) {
  console.log("Received message:", JSON.stringify(message));
  const scheduleAt = message.data ? Buffer.from(message.data, "base64").toString().trim() : null;
  const notificationSpecArray = await getScheduledNotifications(scheduleAt);
  if (notificationSpecArray.length === 0) return;
  const apiKey = await getSecrets();
  sgMail.setApiKey(apiKey);

  const notificationPromises = [];
  for (const notificationSpec of notificationSpecArray) {
    notificationPromises.push(handleNotificationSpec(notificationSpec));
  }

  await Promise.all(notificationPromises);
}

async function handleNotificationSpec(notificationSpec) {
  const primaryField = notificationSpec.primaryField;
  let paramObj = {notificationSpec};
  let cutoffTime = new Date();
  cutoffTime.setDate(cutoffTime.getDate() - notificationSpec.time.day);
  cutoffTime.setHours(cutoffTime.getHours() - notificationSpec.time.hour);
  cutoffTime.setMinutes(cutoffTime.getMinutes() - notificationSpec.time.minute);
  
  // Do nothing if primaryField is a timestamp and time isn't reached. Otherwise, take actions.
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(primaryField)) {
    const scheduledTime = new Date(primaryField);
    if (scheduledTime > cutoffTime) return;
  } else {
    paramObj = {...paramObj, cutoffTimeStr: cutoffTime.toISOString(), timeField: primaryField};
  }

  await getParticipantsAndSendNotifications(paramObj);
}

/**
 * 
 * @param {Object} paramObj
 * @param {Object} paramObj.notificationSpec notification specification object
 * @param {string} paramObj.cutoffTimeStr ISO string used to filter out participants whose primaryField is after this time
 * @param {string} paramObj.timeField Concept ID (eg 914594314) to decide which timestamp field to use for filtering
 */
async function getParticipantsAndSendNotifications({ notificationSpec, cutoffTimeStr, timeField }) {
  const readableSpecString = notificationSpec.email?.subject || notificationSpec.category + ", " + notificationSpec.attempt;
  const conditions = notificationSpec.conditions;
  const emailSubject = notificationSpec.email?.subject ?? "";
  const emailBody = notificationSpec.email?.body ?? "";
  const emailField = notificationSpec.emailField ?? "";
  const smsBody = notificationSpec.sms?.body ?? "";
  const phoneField = notificationSpec.phoneField ?? "";
  const firstNameField = notificationSpec.firstNameField ?? "";
  const preferredNameField = notificationSpec.preferredNameField ?? "";

  let emailHtmlTemplate = emailBody;
  if (emailBody && notificationSpec.category !== "newsletter") {
    const converter = new showdown.Converter();
    emailHtmlTemplate = converter.makeHtml(emailBody);
  }

  let emailContainsToken = false;
  let emailContainsLoginDetails = false;
  let fieldsToFetch = ["Connect_ID", "token", "state.uid"];
  firstNameField && fieldsToFetch.push(firstNameField);
  preferredNameField && fieldsToFetch.push(preferredNameField);
  emailField && fieldsToFetch.push(emailField);
  phoneField && fieldsToFetch.push(phoneField);
  smsBody && fieldsToFetch.push(conceptIds.canWeText.toString());

  if (emailHtmlTemplate) {
    emailHtmlTemplate = emailHtmlTemplate.replace(/<firstName>/g, "{{firstName}}");
    if (emailHtmlTemplate.includes("${token}")) {
      emailContainsToken = true;
      emailHtmlTemplate = emailHtmlTemplate.replace(/\${token}/g, "{{token}}");
    }

    if (emailHtmlTemplate.includes("<loginDetails>")) {
      emailContainsLoginDetails = true;
      emailHtmlTemplate = emailHtmlTemplate.replace(/<loginDetails>/g, "{{loginDetails}}");
      fieldsToFetch.push(
        `${conceptIds.signInMechanism}`,
        `${conceptIds.authenticationPhone}`,
        `${conceptIds.authenticationEmail}`
      );
    }
  }

  const limit = 1000; // SendGrid has a batch limit of 1000
  let offset = 0;
  let hasNext = true;
  let fetchedDataArray = [];
  let emailCount = 0;
  let smsCount = 0;

  while (hasNext) {
    try {
      ({ fetchedDataArray, hasNext } = await getParticipantsForNotificationsBQ({
        notificationSpecId: notificationSpec.id,
        conditions,
        cutoffTimeStr,
        timeField,
        fieldsToFetch,
        limit,
        offset,
      }));
    } catch (error) {
      console.error(`getParticipantsForNotificationsBQ() error running spec ID ${notificationSpec.id}.`, error);
      break;
    }

    if (fetchedDataArray.length === 0) break;

    let emailRecordArray = [];
    let emailPersonalizationArray = [];
    let smsRecordArray = [];

    for (const fetchedData of fetchedDataArray) {
      if (!fetchedData[emailField] && !fetchedData[phoneField]) continue;

      const uniqId = uuid();
      const emailId = uniqId + "-1";
      const smsId = uniqId + "-2";
      const currDateTime = new Date().toISOString();
      const firstName = fetchedData[preferredNameField] || fetchedData[firstNameField];
      const recordCommonData = {
        notificationSpecificationsID: notificationSpec.id,
        attempt: notificationSpec.attempt,
        category: notificationSpec.category,
        token: fetchedData.token,
        uid: fetchedData.state.uid,
        read: false,
      };

      if (emailHtmlTemplate && validEmailFormat.test(fetchedData[emailField])) {
        let substitutions = { firstName };
        let currEmailBody = emailHtmlTemplate.replace(/{{firstName}}/g, firstName);

        if (emailContainsLoginDetails) {
          let loginDetails = "";
          if (fetchedData[conceptIds.signInMechanism] === "phone" && fetchedData[conceptIds.authenticationPhone]) {
            loginDetails = redactPhoneLoginInfo(fetchedData[conceptIds.authenticationPhone]);
          } else if (
            fetchedData[conceptIds.signInMechanism] === "password" &&
            fetchedData[conceptIds.authenticationEmail]
          ) {
            loginDetails = redactEmailLoginInfo(fetchedData[conceptIds.authenticationEmail]);
          } else if (
            fetchedData[conceptIds.signInMechanism] === "passwordAndPhone" &&
            fetchedData[conceptIds.authenticationEmail] &&
            fetchedData[conceptIds.authenticationPhone]
          ) {
            loginDetails =
              redactEmailLoginInfo(fetchedData[conceptIds.authenticationEmail]) +
              " or " +
              redactPhoneLoginInfo(fetchedData[conceptIds.authenticationPhone]);
          } else {
            console.log("No login details found for participant with token:", fetchedData.token);
            continue;
          }

          substitutions.loginDetails = loginDetails;
          currEmailBody = currEmailBody.replace(/{{loginDetails}}/g, loginDetails);
        }

        if (emailContainsToken) {
          substitutions.token = fetchedData.token;
          currEmailBody = currEmailBody.replace(/{{token}}/g, fetchedData.token);
        }

        emailPersonalizationArray.push({
          to: fetchedData[emailField],
          substitutions,
          custom_args: {
            connect_id: fetchedData.Connect_ID,
            token: fetchedData.token,
            notification_id: emailId,
            gcloud_project: process.env.GCLOUD_PROJECT,
          },
        });

        emailRecordArray.push({
          ...recordCommonData,
          id: emailId,
          notificationType: "email",
          email: fetchedData[emailField],
          notification: {
            title: emailSubject,
            body: currEmailBody,
            time: currDateTime,
          },
        });
      }

      let canWeText = fetchedData[conceptIds.canWeText];
      // TODO: remove data type check after cleaning up mixed data types of conceptIds.canWeText in dev and stage.
      if (typeof canWeText === "object" && canWeText.integer) {
        canWeText = canWeText.integer;
      }

      if (smsBody && fetchedData[phoneField]?.length >= 10 && canWeText === conceptIds.yes) {
        const phoneNumber = fetchedData[phoneField].replace(/\D/g, "");
        if (phoneNumber.length >= 10) {
          const currSmsBody = smsBody.replace(/<firstName>/g, firstName);
          const currSmsTo = `+1${phoneNumber.slice(-10)}`;

          smsRecordArray.push({
            ...recordCommonData,
            id: smsId,
            notificationType: "sms",
            phone: currSmsTo,
            notification: {
              body: currSmsBody,
              time: currDateTime,
            },
          });
        }
      }
    }
    
    if (emailPersonalizationArray.length === 0 && smsRecordArray.length === 0) continue;

    if (emailPersonalizationArray.length > 0) {
      const emailBatch = {
        from: {
          name: process.env.SG_FROM_NAME || "Connect for Cancer Prevention Study",
          email: process.env.SG_FROM_EMAIL || "donotreply@myconnect.cancer.gov",
        },
        subject: emailSubject,
        html: emailHtmlTemplate,
        personalizations: emailPersonalizationArray,
      };

      try {
        await sgMail.send(emailBatch);
      } catch (error) {
        console.error(`Error sending emails for ${notificationSpec.id}(${readableSpecString}).`, error);
        break;
      }

      emailCount += emailRecordArray.length;
    }

    if (smsRecordArray.length > 0) {
      smsRecordArray = await sendSmsBatch(smsRecordArray);
      smsCount += smsRecordArray.length;
    }


    
    if ((emailRecordArray[0] && emailRecordArray[0].category === '3mo QOL Survey Reminders' && emailRecordArray[0].attempt === '1st Contact') ||
        (smsRecordArray[0] && smsRecordArray[0].category === '3mo QOL Survey Reminders' && smsRecordArray[0].attempt === '1st Contact')) {

      const { moduleStatusConcepts, findKeyByValue } = require('./shared');
      const surveyStatus = findKeyByValue(moduleStatusConcepts, 'promis');
  
      for (let participant of [...emailRecordArray, ...smsRecordArray]) {

        const token = participant.token;

        try {
          const { updateSurveyEligibility } = require('./firestore');
          await updateSurveyEligibility(token, surveyStatus);
        }
        catch (error) {
          console.error(`Error updating survey eligibility for token ${token}`, error);
          break;
        }
      }
    }
    

    try {
      await saveNotificationBatch([...emailRecordArray, ...smsRecordArray]);
    } catch (error) {
      console.error(`Error saving data for ${notificationSpec.id}(${readableSpecString}).`, error);
      break;
    }

    offset += limit;
  }

  if (emailCount === 0 && smsCount === 0) {
    console.log(`Finished notification spec: ${notificationSpec.id}(${readableSpecString}). No emails or sms sent.`);
  } else {
    console.log(
      `Finished notification spec: ${notificationSpec.id}(${readableSpecString}), emails sent: ${emailCount}, sms sent: ${smsCount}`
    );
  }
}

const storeNotificationSchema = async (req, res, authObj) => {
  logIPAdddress(req);
  setHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).json({ code: 200 });

  if (req.method !== "POST") return res.status(405).json(getResponseJSON("Only POST requests are accepted!", 405));

  if (!authObj) return res.status(401).json(getResponseJSON("Authorization failed!", 401));

  if (req.body.data === undefined || Object.keys(req.body.data).length < 1)
    return res.status(400).json(getResponseJSON("Bad requuest.", 400));

  const schema = req.body.data;
  if (schema.id) {
    const { retrieveNotificationSchemaByID } = require("./firestore");
    const docID = await retrieveNotificationSchemaByID(schema.id);
    if (docID === "") return res.status(404).json(getResponseJSON("Invalid notification Id.", 404));

    const { updateNotificationSchema } = require("./firestore");
    schema["modifiedAt"] = new Date().toISOString();
    if (authObj.userEmail) schema["modifiedBy"] = authObj.userEmail;
    await updateNotificationSchema(docID, schema);
  } else {
    schema["id"] = uuid();
    const { storeNewNotificationSchema } = require("./firestore");
    schema["createdAt"] = new Date().toISOString();
    if (authObj.userEmail) schema["createdBy"] = authObj.userEmail;
    await storeNewNotificationSchema(schema);
  }

  return res.status(200).json({ message: "Success!", code: 200, data: [{ schemaId: schema.id }] });
};

const retrieveNotificationSchema = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'GET') return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));

    if(!authObj) return res.status(401).json(getResponseJSON('Authorization failed!', 401));

    if(!req.query.category) return res.status(400).json(getResponseJSON('category is missing in request parameter!', 400));

    const category = req.query.category;
    const getDrafts = req.query.drafts === "true";
    const { retrieveNotificationSchemaByCategory } = require('./firestore');
    const data = await retrieveNotificationSchemaByCategory(category, getDrafts);
    if (data.length === 0) return res.status(404).json(getResponseJSON(`Notification schema not found for given category - ${category}`, 404));

    return res.status(200).json({data, code:200});
}

const getParticipantNotification = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if (req.method !== 'GET') return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    
    let obj = {};
    if (authObj) obj = authObj;
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    
        const { isParentEntity } = require('./shared');
        obj = await isParentEntity(authorized);
    }

    if(!req.query.token) return res.status(400).json(getResponseJSON('token is missing in request parameter!', 400));
    const token = req.query.token;
    const isParent = obj.isParent;
    const siteCodes = obj.siteCodes;
    const { getNotificationHistoryByParticipant } = require('./firestore');
    const data = await getNotificationHistoryByParticipant(token, siteCodes, isParent);
    if(!data) return res.status(400).json(getResponseJSON('Invalid token or you are not authorized to access data for given token', 200));

    return res.status(200).json({data, code: 200})
}

const getSiteNotification = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if (req.method !== 'GET') return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    
    let obj = {};
    if (authObj) obj = authObj;
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    
        const { isParentEntity } = require('./shared');
        obj = await isParentEntity(authorized);
    }

    const isParent = obj.isParent;
    const siteId = obj.id;
    const { retrieveSiteNotifications } = require('./firestore');
    const data = await retrieveSiteNotifications(siteId, isParent);
    if(data !== false){
        markAllNotificationsAsAlreadyRead(data.map(dt => dt.id), 'siteNotifications');
    }
    return res.status(200).json({data, code: 200})
}

module.exports = {
    subscribeToNotification,
    retrieveNotifications,
    notificationHandler,
    storeNotificationSchema,
    retrieveNotificationSchema,
    getParticipantNotification,
    sendEmail,
    getSiteNotification
}