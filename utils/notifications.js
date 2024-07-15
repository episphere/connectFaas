const { v4: uuid } = require("uuid");
const sgMail = require("@sendgrid/mail");
const showdown = require("showdown");
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const {getResponseJSON, setHeadersDomainRestricted, setHeaders, logIPAdddress, redactEmailLoginInfo, redactPhoneLoginInfo, createChunkArray, validEmailFormat, getTemplateForEmailLink, nihMailbox, getSecret, cidToLangMapper, unsubscribeTextObj} = require("./shared");
const {getNotificationSpecById, getNotificationSpecByCategoryAndAttempt, getNotificationSpecsByScheduleOncePerDay, saveNotificationBatch, updateSurveyEligibility, generateSignInWithEmailLink, storeNotification, checkIsNotificationSent, getNotificationSpecsBySchedule} = require("./firestore");
const {getParticipantsForNotificationsBQ} = require("./bigquery");
const conceptIds = require("./fieldToConceptIdMapping");

const converter = new showdown.Converter();
const langArray = ["english", "spanish"];
let twilioClient, messagingServiceSid;
let isSendingNotifications = false; // A more robust soluttion is needed when using multiple servers 

getSecret(process.env.GCLOUD_SENDGRID_SECRET).then((apiKey) => {
  sgMail.setApiKey(apiKey);
});

setupTwilioSms().then(([client, sid]) => {
  twilioClient = client;
  messagingServiceSid = sid;
 });

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
        chunk[i].errorCode = messageArray[i].error_code || "";
        chunk[i].errorMessage = messageArray[i].error_message || "";
        chunk[i].status = messageArray[i].status || "";
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
  if (req.method !== "GET") {
    return res.status(405).json(getResponseJSON("Only GET requests are accepted!", 405));
  }

  const { retrieveUserNotifications } = require("./firestore");

  try {
    const notificationArray = await retrieveUserNotifications(uid);
    if (notificationArray.length > 0) {
      markAllNotificationsAsAlreadyRead(
        notificationArray.map((notification) => notification.id),
        "notifications"
      );
    }
    return res.status(200).json({ data: notificationArray, message: "Success", code: 200 });
  } catch (error) {
    console.error("Error when retrieving notifications.", error);
    return res.status(500).json({ data: [], message: "Internal Server Error", code: 500 });
  }
};

const sendEmail = async (emailTo, messageSubject, html, cc) => {
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
async function sendScheduledNotifications(message) {
  if (isSendingNotifications) {
    console.log("Function sendScheduledNotifications() is already running. Exiting...");
    return;
  }

  console.log("Received message:", JSON.stringify(message));
  isSendingNotifications = true;
  const scheduleAt = message.data ? Buffer.from(message.data, "base64").toString().trim() : null;
  
  try {
    const notificationSpecArray = await getNotificationSpecsByScheduleOncePerDay(scheduleAt);
    if (notificationSpecArray.length === 0) {
      console.log("Function sendScheduledNotifications has run earlier today. Exiting...");
      return;
    }

    const notificationPromises = [];
    for (const notificationSpec of notificationSpecArray) {
      notificationPromises.push(handleNotificationSpec(notificationSpec));
    }

    await Promise.allSettled(notificationPromises);
  } catch (error) {
    console.error("Error occurred running function sendScheduledNotifications.", error);
  } finally {
    isSendingNotifications = false;
  }
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
    paramObj = {...paramObj, cutoffTimeStr: "", timeField: ""};
  } else {
    paramObj = {...paramObj, cutoffTimeStr: cutoffTime.toISOString(), timeField: primaryField};
  }

  await getParticipantsAndSendNotifications(paramObj);
}

/**
 * 
 * @param {Object} paramObj
 * @param {Object} paramObj.notificationSpec Notification specification
 * @param {string} [paramObj.cutoffTimeStr=""] ISO string used to filter out participants whose primaryField is after this time
 * @param {string} [paramObj.timeField=""] Concept ID (eg 914594314) to decide which timestamp field to use for filtering
 */
async function getParticipantsAndSendNotifications({ notificationSpec, cutoffTimeStr = "", timeField = "" }) {
  const readableSpecString = notificationSpec.category + ", " + notificationSpec.attempt;
  const conditions = notificationSpec.conditions;
  const emailField = notificationSpec.emailField ?? "";
  const phoneField = notificationSpec.phoneField ?? "";
  const firstNameField = notificationSpec.firstNameField ?? "";
  const preferredNameField = notificationSpec.preferredNameField ?? "";
  const newsletterCategories = ["newsletter", "eNewsletter", "anniversaryNewsletter"];
  
  let fieldsToFetch = ["Connect_ID", "token", "state.uid", conceptIds.preferredLanguage.toString()];
  firstNameField && fieldsToFetch.push(firstNameField);
  preferredNameField && fieldsToFetch.push(preferredNameField);
  emailField && fieldsToFetch.push(emailField);
  phoneField && fieldsToFetch.push(phoneField);
  notificationSpec.notificationType.includes("sms") && fieldsToFetch.push(conceptIds.canWeText.toString());

  let emailInSpec = notificationSpec.email || {};
  let smsInSpec = notificationSpec.sms || {};
  let emailHasToken = false;
  let emailHasLoginDetails = false;
  let emailCount = { total: 0 };
  let smsCount = { total: 0 };

  for (const lang of langArray) {
    if (emailInSpec[lang]?.body) {
      let emailBody = emailInSpec[lang].body;
      if (!newsletterCategories.includes(notificationSpec.category)) {
        emailBody = converter.makeHtml(emailBody);
      }

      emailBody = emailBody.replace(/<firstName>/g, "{{firstName}}");
      if (emailBody.includes("${token}")) {
        emailHasToken = true;
        emailBody = emailBody.replace(/\${token}/g, "{{token}}");
      }

      if (emailBody.includes("<loginDetails>")) {
        emailHasLoginDetails = true;
        emailBody = emailBody.replace(/<loginDetails>/g, "{{loginDetails}}");
        fieldsToFetch.push(
          `${conceptIds.signInMechanism}`,
          `${conceptIds.authenticationPhone}`,
          `${conceptIds.authenticationEmail}`
        );
      }

      emailInSpec[lang].body = emailBody;
    }

    emailCount[lang] = 0;
    smsCount[lang] = 0;
  }

  const limit = 1000; // SendGrid has a batch limit of 1000
  let previousConnectId = 0;
  let hasNext = true;
  let fetchedDataArray = [];

  while (hasNext) {
    try {
      fetchedDataArray = await getParticipantsForNotificationsBQ({
        notificationSpecId: notificationSpec.id,
        conditions,
        cutoffTimeStr,
        timeField,
        fieldsToFetch,
        limit,
        previousConnectId,
      });
    } catch (error) {
      console.error(`getParticipantsForNotificationsBQ() error running spec ID ${notificationSpec.id}.`, error);
      break;
    }

    if (fetchedDataArray.length === 0) break;

    hasNext = fetchedDataArray.length === limit;
    if (hasNext) {
      previousConnectId = fetchedDataArray[fetchedDataArray.length - 1].Connect_ID;
    }

    let notificationData = {};
    for (const lang of langArray) {
      notificationData[lang] = {
        emailRecordArray: [],
        emailPersonalizationArray: [],
        smsRecordArray: [],
      };
    }

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

      const prefLang = cidToLangMapper[fetchedData[conceptIds.preferredLanguage]] || "english";
      const emailOfPrefLang = emailInSpec[prefLang];

      if (emailOfPrefLang?.body && validEmailFormat.test(fetchedData[emailField])) {
        let substitutions = { firstName };
        let currEmailBody = emailOfPrefLang.body.replace(/{{firstName}}/g, firstName);

        if (emailHasLoginDetails) {
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
              redactPhoneLoginInfo(fetchedData[conceptIds.authenticationPhone]) +
              ", " +
              redactEmailLoginInfo(fetchedData[conceptIds.authenticationEmail]);
          } else {
            console.log("No login details found for participant with token:", fetchedData.token);
            continue;
          }

          substitutions.loginDetails = loginDetails;
          currEmailBody = currEmailBody.replace(/{{loginDetails}}/g, loginDetails);
        }

        if (emailHasToken) {
          substitutions.token = fetchedData.token;
          currEmailBody = currEmailBody.replace(/{{token}}/g, fetchedData.token);
        }

        notificationData[prefLang].emailPersonalizationArray.push({
          to: fetchedData[emailField],
          substitutions,
          custom_args: {
            connect_id: fetchedData.Connect_ID,
            token: fetchedData.token,
            notification_id: emailId,
            gcloud_project: process.env.GCLOUD_PROJECT,
          },
        });

        notificationData[prefLang].emailRecordArray.push({
          ...recordCommonData,
          id: emailId,
          notificationType: "email",
          language: prefLang,
          email: fetchedData[emailField],
          notification: {
            title: emailOfPrefLang.subject,
            body: currEmailBody,
            time: currDateTime,
          },
        });
      }

      // Handle mixed data types of conceptIds.canWeText. Remove this after fixing bug causing string data type.
      let canWeText = fetchedData[conceptIds.canWeText];
      if (typeof canWeText === "object" && canWeText.integer) {
        canWeText = canWeText.integer;
      }

      const smsOfPrefLang = smsInSpec[prefLang];
      if (smsOfPrefLang?.body && fetchedData[phoneField]?.length >= 10 && canWeText === conceptIds.yes) {
        const phoneNumber = fetchedData[phoneField].replace(/\D/g, "");
        if (phoneNumber.length >= 10) {
          const currSmsBody = smsOfPrefLang.body.replace(/<firstName>/g, firstName);
          const currSmsTo = `+1${phoneNumber.slice(-10)}`;

          notificationData[prefLang].smsRecordArray.push({
            ...recordCommonData,
            id: smsId,
            notificationType: "sms",
            language: prefLang,
            phone: currSmsTo,
            notification: {
              body: currSmsBody,
              time: currDateTime,
            },
          });
        }
      }
    }
    
    for (const lang of langArray) {
      let { emailRecordArray, emailPersonalizationArray, smsRecordArray } = notificationData[lang];
      if (emailPersonalizationArray.length > 0) {
        const emailBatch = {
            from: {
                name:
                    process.env.SG_FROM_NAME ||
                    "Connect for Cancer Prevention Study",
                email:
                    process.env.SG_FROM_EMAIL ||
                    "donotreply@myconnect.cancer.gov",
            },
            subject: emailInSpec[lang].subject,
            html: emailInSpec[lang].body,
            personalizations: emailPersonalizationArray,
            tracking_settings: {
                subscription_tracking: {
                    enable: true,
                    html: unsubscribeTextObj[lang] || unsubscribeTextObj.english
                },
            },
        };
  
        try {
          await sgMail.send(emailBatch);
          await saveNotificationBatch(emailRecordArray);
          emailCount[lang] += emailRecordArray.length;
        } catch (error) {
          if (error.message.startsWith("saveNotificationBatch")) {
            console.error(`Error saving email records for ${notificationSpec.id}(${readableSpecString}).`, error);
          } else {
            console.error(`Error sending emails for ${notificationSpec.id}(${readableSpecString}).`, error);
          }
  
          break;
        }
      }
  
      if (smsRecordArray.length > 0) {
        try {
          smsRecordArray = await sendSmsBatch(smsRecordArray);
          if (smsRecordArray.length > 0) {
            await saveNotificationBatch(smsRecordArray);
            smsCount[lang] += smsRecordArray.length;
          }
        } catch (error) {
          console.error(`Error saving SMS records for ${notificationSpec.id}(${readableSpecString}).`, error);
          break;
        }
      }
    }

    if (notificationSpec.category === "3mo QOL Survey Reminders" && notificationSpec.attempt === "1st contact") {
      const { moduleStatusConcepts, findKeyByValue } = require("./shared");
      const surveyStatus = findKeyByValue(moduleStatusConcepts, "promis");

      let tokenArray = [];
      for (const { emailRecordArray, smsRecordArray } of Object.values(notificationData)) {
        tokenArray = [
          ...tokenArray,
          ...emailRecordArray.map((record) => record.token),
          ...smsRecordArray.map((record) => record.token),
        ];
      }

      const tokenSet = new Set(tokenArray);
      for (const token of tokenSet) {
        try {
          await updateSurveyEligibility(token, surveyStatus);
        } catch (error) {
          console.error(`Error updating survey eligibility for token ${token}`, error);
          break;
        }
      }
    }

  }
  
  for (const lang of langArray) {
    emailCount.total += emailCount[lang];
    smsCount.total += smsCount[lang];
  }

  let messageArray = [`Finished notification spec: ${notificationSpec.id}(${readableSpecString})`];
  if (emailCount.total === 0) {
    messageArray.push("No emails sent");
  } else {
    for (const lang of langArray) {
      messageArray.push(`Email (${lang}) sent: ${emailCount[lang]}`);
    }
  }

  if (smsCount.total === 0) {
    messageArray.push("No sms sent");
  } else {
    for (const lang of langArray) {
      messageArray.push(`SMS (${lang}) sent: ${smsCount[lang]}`);
    }
  }

  console.log(messageArray.join(". ") + ".");
}

const storeNotificationSchema = async (req, res, authObj) => {
  logIPAdddress(req);
  setHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).json({ code: 200 });

  if (req.method !== "POST") return res.status(405).json(getResponseJSON("Only POST requests are accepted!", 405));

  if (!authObj) return res.status(401).json(getResponseJSON("Authorization failed!", 401));

  if (req.body.data === undefined || Object.keys(req.body.data).length < 1)
    return res.status(400).json(getResponseJSON("Bad requuest.", 400));

  try {
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
  } catch (error) {
    console.error("Error occurred storing notification schema.", error);
    return res.status(500).json({ message: error.message, code: 500, data: [] });
  }

};

const retrieveNotificationSchema = async (req, res, authObj) => {
  logIPAdddress(req);
  setHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).json({ code: 200 });

  if (req.method !== "GET") return res.status(405).json(getResponseJSON("Only GET requests are accepted!", 405));

  if (!authObj) return res.status(401).json(getResponseJSON("Authorization failed!", 401));

  if (!req.query.category)
    return res.status(400).json(getResponseJSON("category is missing in request parameter!", 400));

  const category = req.query.category;
  const getDrafts = req.query.drafts === "true";
  const sendType = req.query.sendType || "scheduled";
  const { retrieveNotificationSchemaByCategory } = require("./firestore");
  try {
    const schemaArray = await retrieveNotificationSchemaByCategory(category, getDrafts, sendType);
    if (schemaArray.length === 0)
      return res.status(404).json({ data: [], message: `Notification schema not found for given category - ${category}`, code: 404 });

    return res.status(200).json({ data: schemaArray, code: 200 });
  } catch (error) {
    console.error("Error retrieving notification schemas.", error);
    return res.status(500).json({ data: [], message: error.message, code: 500 });
  }
};

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

const sendEmailLink = async (req, res) => {
    if (req.method !== "POST") {
        return res
            .status(405)
            .json(getResponseJSON("Only POST requests are accepted!", 405));
    }
    try {
        const { email, continueUrl } = req.body;
        const [clientId, clientSecret, tenantId, magicLink] = await Promise.all(
            [
                getSecret(process.env.APP_REGISTRATION_CLIENT_ID),
                getSecret(process.env.APP_REGISTRATION_CLIENT_SECRET),
                getSecret(process.env.APP_REGISTRATION_TENANT_ID),
                generateSignInWithEmailLink(email, continueUrl),
            ]
        );

        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("scope", "https://graph.microsoft.com/.default");
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);

        const resAuthorize = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded;charset=UTF-8",
                },
                body: params,
            }
        );

        const { access_token } = await resAuthorize.json();

        const body = {
            message: {
                subject: `Sign in to Connect for Cancer Prevention Study`,
                body: {
                    contentType: "html",
                    content: getTemplateForEmailLink(email, magicLink),
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: email,
                        },
                    },
                ],
            },
        };
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${nihMailbox}/sendMail`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                },
                body: JSON.stringify(body),
            }
        );
        const { status, statusText: code } = response;
        return res.status(202).json({ status, code });
        
    } catch (err) {
        console.error(`Error in sendEmailLink(). ${err.message}`);
        return res
            .status(500)
            .json({
                data: [],
                message: `Error in sendEmailLink(). ${err.message}`,
                code: 500,
            });
    }
};

const dryRunNotificationSchema = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ data: [], message: "Only GET requests are accepted!", code: 405 });
  }

  if (!req.query.schemaId) {
    return res.status(400).json({ data: [], message: "schemaId is missing in request parameter!", code: 400 });
  }

  let spec = null;
  try {
    spec = await getNotificationSpecById(req.query.schemaId);
    if (!spec) {
      const message = `Notification spec ID ${req.query.schemaId} isn't found.`;
      return res.status(404).json({ data: [], message, code: 404 });
    }
    const { data, message, code } = await handleDryRun(spec);
    return res.status(code).json({ data, message, code });

  } catch (error) {
    return res.status(500).json({ data: [], message: JSON.stringify(error, null, 2), code: 500 });
  }

};

async function handleDryRun(spec) {
  let timeField = spec.primaryField;
  let cutoffTime = new Date();
  let cutoffTimeStr = cutoffTime.toISOString();
  cutoffTime.setDate(cutoffTime.getDate() - spec.time.day);
  cutoffTime.setHours(cutoffTime.getHours() - spec.time.hour);
  cutoffTime.setMinutes(cutoffTime.getMinutes() - spec.time.minute);

  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(spec.primaryField)) {
    const scheduledTime = new Date(spec.primaryField);
    if (scheduledTime > cutoffTime) return { data: [], message: "Ok", code: 200 };
    timeField = "";
    cutoffTimeStr = "";
  }

  const emailInSpec = spec.email || {};
  const smsInSpec = spec.sms || {};
  const emailField = spec.emailField ?? "";
  const phoneField = spec.phoneField ?? "";
  let fieldsToFetch = ["token", "Connect_ID", conceptIds.preferredLanguage.toString()];
  emailField && fieldsToFetch.push(emailField);
  phoneField && fieldsToFetch.push(phoneField);
  spec.notificationType.includes("sms") && fieldsToFetch.push(conceptIds.canWeText.toString());

  const limit = 1000;
  let previousConnectId = 0;
  let hasNext = true;
  let fetchedDataArray = [];
  let countObj = { email: {}, sms: {} };

  for (const lang of langArray) {
    countObj.email[lang] = 0;
    countObj.sms[lang] = 0;
  }

  while (hasNext) {
    try {
      fetchedDataArray = await getParticipantsForNotificationsBQ({
        notificationSpecId: spec.id,
        conditions: spec.conditions,
        cutoffTimeStr,
        timeField,
        fieldsToFetch,
        limit,
        previousConnectId,
      });
    } catch (error) {
      console.error(`Error dry running spec ID ${spec.id}.`, error);
      return { data: [countObj], message: JSON.stringify(error, null, 2), code: 500 };
    }

    if (fetchedDataArray.length === 0) break;
    hasNext = fetchedDataArray.length === limit;
    if (hasNext) {
      previousConnectId = fetchedDataArray[fetchedDataArray.length - 1].Connect_ID;
    }

    for (const fetchedData of fetchedDataArray) {
      if (!fetchedData[emailField] && !fetchedData[phoneField]) continue;

      const prefLang = cidToLangMapper[fetchedData[conceptIds.preferredLanguage]] || "english";

      if (emailInSpec[prefLang] && validEmailFormat.test(fetchedData[emailField])) {
        countObj.email[prefLang]++;
      }

      if (
        smsInSpec[prefLang] &&
        fetchedData[phoneField]?.length >= 10 &&
        fetchedData[conceptIds.canWeText] === conceptIds.yes
      ) {
        countObj.sms[prefLang]++;
      }
    }
  }

  return { data: [countObj], message: "Ok", code: 200 };
}

const sendInstantNotification = async (requestData) => {
  const notificationSpec = await getNotificationSpecByCategoryAndAttempt(requestData.category, requestData.attempt);
  if (!notificationSpec) {
    throw new Error(`Notification spec not found for category: "${requestData.category}", attempt: "${requestData.attempt}".`);
  }

  const isNotificationSent = await checkIsNotificationSent(requestData.token, notificationSpec.id);
  if (isNotificationSent) {
    throw new Error(`Notification already sent for participant with ID ${requestData.connectId}.`);
  }

  const uuidStr = uuid();
  const emailOfPrefLang = notificationSpec.email[requestData.preferredLanguage] || notificationSpec.email.english;
  const currEmailBody = emailOfPrefLang.body
    .replace(/{{firstName}}/g, requestData.substitutions.firstName)
    .replace(/{{loginDetails}}/g, requestData.substitutions.loginDetails);

  const emailDataToSg = {
    from: {
      name: process.env.SG_FROM_NAME || "Connect for Cancer Prevention Study",
      email: process.env.SG_FROM_EMAIL || "donotreply@myconnect.cancer.gov",
    },
    subject: emailOfPrefLang.subject,
    html: emailOfPrefLang.body,
    personalizations: [
      {
        to: requestData.email,
        substitutions: requestData.substitutions,
        custom_args: {
          connect_id: requestData.connectId,
          token: requestData.token,
          notification_id: uuidStr,
          gcloud_project: process.env.GCLOUD_PROJECT,
        },
      },
    ],
    tracking_settings: {
      subscription_tracking: {
          enable: true,
          html: unsubscribeTextObj[requestData.preferredLanguage] || unsubscribeTextObj.english
      },
    },
  };
  await sgMail.send(emailDataToSg);

  const currEmailRecord = {
    id: uuidStr,
    notificationType: "email",
    language: requestData.preferredLanguage,
    email: requestData.email,
    notification: {
      title: emailOfPrefLang.subject,
      body: currEmailBody,
      time: new Date().toISOString(),
    },
    notificationSpecificationsID: notificationSpec.id,
    attempt: requestData.attempt,
    category: requestData.category,
    token: requestData.token,
    uid: requestData.uid,
    read: false,
  };
  await storeNotification(currEmailRecord);
};

module.exports = {
  subscribeToNotification,
  retrieveNotifications,
  sendScheduledNotifications,
  storeNotificationSchema,
  retrieveNotificationSchema,
  getParticipantNotification,
  sendEmail,
  getSiteNotification,
  sendEmailLink,
  dryRunNotificationSchema,
  sendInstantNotification,
  handleDryRun,
};
