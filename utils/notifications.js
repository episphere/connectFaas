const uuid = require("uuid");
const sgMail = require("@sendgrid/mail");
const showdown = require("showdown");
const {getResponseJSON, setHeadersDomainRestricted, setHeaders, logIPAdddress, redactEmailLoginInfo, redactPhoneLoginInfo} = require("./shared");
const {getEmailNotifications, saveNotificationBatch, saveSpecIdsToParticipants} = require("./firestore");
const {getParticipantsForNotificationsBQ} = require("./bigquery");

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

const sendSms = (phoneNo) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.messages
        .create({body: 'Thanks for joining Connect', from: process.env.from_phone_no, to: phoneNo})
        .then(message => console.log(message.sid));
}

const getSecrets = async () => {
    const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
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

async function notificationHandler(message) {
  console.log("Received message:", JSON.stringify(message));
  const scheduleAt = message.data ? Buffer.from(message.data, "base64").toString().trim() : null;
  const notificationSpecArray = await getEmailNotifications(scheduleAt);
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

  await getParticipantsAndSendEmails(paramObj);
}

async function getParticipantsAndSendEmails({notificationSpec, cutoffTimeStr, timeField}) {
  const notificationSpecId = notificationSpec.id;
  if (!notificationSpecId) return;
  const conditions = notificationSpec.conditions;
  const messageBody = notificationSpec.email.body;
  const messageSubject = notificationSpec.email.subject;
  const emailField = notificationSpec.emailField;
  const firstNameField = notificationSpec.firstNameField;
  const preferredNameField = notificationSpec.preferredNameField;

  let htmlTemplate = messageBody;
  if (notificationSpec.category !== "newsletter") {
    const converter = new showdown.Converter();
    htmlTemplate = converter.makeHtml(messageBody);
  }

  let htmlContainsToken = false;
  let htmlContainsLoginDetails = false;
  let fieldsToFetch = ["Connect_ID", "token", "state.uid"];
  firstNameField && fieldsToFetch.push(firstNameField);
  preferredNameField && fieldsToFetch.push(preferredNameField);
  emailField && fieldsToFetch.push(emailField);

  htmlTemplate = htmlTemplate.replace("<firstName>", "{{firstName}}");
  if (htmlTemplate.includes("${token}")) {
    htmlContainsToken = true;
    htmlTemplate = htmlTemplate.replace("${token}", "{{token}}");
  }

  if (htmlTemplate.includes("<loginDetails>")) {
    htmlContainsLoginDetails = true;
    htmlTemplate = htmlTemplate.replace("<loginDetails>", "{{loginDetails}}");
    fieldsToFetch.push("995036844", "348474836", "421823980");
  }

  const limit = 1000; // SendGrid has a batch limit of 1000
  let offset = 0;
  let hasNext = true;
  let fetchedDataArray = [];
  let emailCount = 0;

  while (hasNext) {
    ({fetchedDataArray, hasNext} = await getParticipantsForNotificationsBQ({
      notificationSpecId,
      conditions,
      cutoffTimeStr,
      timeField,
      fieldsToFetch,
      limit,
      offset,
    }));
    if (fetchedDataArray.length === 0) break;
    let participantTokenArray = [];
    let notificationRecordArray = [];
    let personalizationArray = [];

    for (const fetchedData of fetchedDataArray) {
      if (!fetchedData[emailField]) continue;
      let notificationBody = htmlTemplate;
      let substitutions = {};
      if (htmlContainsLoginDetails) {
        let loginDetails = "";

        if (fetchedData[995036844] === "phone" && fetchedData[348474836]) {
          loginDetails = redactPhoneLoginInfo(fetchedData[348474836]);
        } else if (fetchedData[995036844] === "password" && fetchedData[421823980]) {
          loginDetails = redactEmailLoginInfo(fetchedData[421823980]);
        } else if (fetchedData[995036844] === 'passwordAndPhone' && fetchedData[421823980] && fetchedData[348474836]) {
          loginDetails = redactEmailLoginInfo(fetchedData[421823980]) + " or " + redactPhoneLoginInfo(fetchedData[348474836]);
        } else {
          console.log("No login details found for participant with token:", fetchedData.token);
          continue;
        }

        substitutions.loginDetails = loginDetails;
        notificationBody = notificationBody.replace("{{loginDetails}}", loginDetails);
      }

      const firstName = fetchedData[preferredNameField] || fetchedData[firstNameField];
      substitutions.firstName = firstName;
      notificationBody = notificationBody.replace("{{firstName}}", firstName);

      if (htmlContainsToken) {
        substitutions.token = fetchedData.token;
        notificationBody = notificationBody.replace("{{token}}", fetchedData.token);
      }

      const notification_id = uuid();
      personalizationArray.push({
        to: fetchedData[emailField],
        substitutions,
        custom_args: {
          notification_id,
          gcloud_project: process.env.GCLOUD_PROJECT
        },
      });
      participantTokenArray.push(fetchedData.token);

      const notificationRecord = {
        notificationSpecificationsID: notificationSpecId,
        id: notification_id,
        notificationType: notificationSpec.notificationType[0],
        email: fetchedData[emailField],
        notification: {
          title: messageSubject,
          body: notificationBody,
          time: new Date().toISOString(),
        },
        attempt: notificationSpec.attempt,
        category: notificationSpec.category,
        token: fetchedData.token,
        uid: fetchedData.state.uid,
        read: false,
      };

      notificationRecordArray.push(notificationRecord);
    }

    if (personalizationArray.length === 0) continue;

    const msgBatch = {
      from: {
        name: process.env.SG_FROM_NAME || "Connect for Cancer Prevention Study",
        email: process.env.SG_FROM_EMAIL || "donotreply@myconnect.cancer.gov",
      },
      subject: messageSubject,
      html: htmlTemplate,
      personalizations: personalizationArray,
    };

    try {
      await sgMail.send(msgBatch);
    } catch (error) {
      console.error(`Error sending emails for ${notificationSpecId}(${messageSubject}).`, error);
      break;
    }

    emailCount += personalizationArray.length;

    try {
      await Promise.all([
        saveNotificationBatch(notificationRecordArray),
        saveSpecIdsToParticipants(notificationSpecId, participantTokenArray),
      ]);
    } catch (error) {
      console.error(`Error saving data for ${notificationSpecId}(${messageSubject}).`, error);
      break;
    }

    offset += limit;
  }
  console.log(`Finished notification spec: ${notificationSpecId}(${messageSubject}), emails sent: ${emailCount}`);
}

const storeNotificationSchema = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'POST') return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));

    if(!authObj) return res.status(401).json(getResponseJSON('Authorization failed!', 401));

    if(req.body.data === undefined || Object.keys(req.body.data).length < 1 ) return res.status(400).json(getResponseJSON('Bad requuest.', 400));

    const data = req.body.data;
    if(data.id) {
        const { retrieveNotificationSchemaByID } = require('./firestore');
        const docID = await retrieveNotificationSchemaByID(data.id);
        if(docID instanceof Error) return res.status(404).json(getResponseJSON(docID.message, 404));
        const { updateNotificationSchema } = require('./firestore');
        data['modifiedAt'] = new Date().toISOString();
        if(authObj.userEmail) data['modifiedBy'] = authObj.userEmail;
        await updateNotificationSchema(docID, data);
    }
    else {
        const uuid = require('uuid')
        data['id'] = uuid();
        const { storeNewNotificationSchema } = require('./firestore');
        data['createdAt'] = new Date().toISOString();
        if(authObj.userEmail) data['createdBy'] = authObj.userEmail;
        await storeNewNotificationSchema(data);
    }
    return res.status(200).json(getResponseJSON('Ok', 200));
}

const retrieveNotificationSchema = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'GET') return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));

    if(!authObj) return res.status(401).json(getResponseJSON('Authorization failed!', 401));

    if(!req.query.category) return res.status(400).json(getResponseJSON('category is missing in request parameter!', 400));

    const category = req.query.category;
    const { retrieveNotificationSchemaByCategory } = require('./firestore');
    const data = await retrieveNotificationSchemaByCategory(category);
    if(!data) return res.status(404).json(getResponseJSON(`Notification schema not found for given category - ${category}`, 404))
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