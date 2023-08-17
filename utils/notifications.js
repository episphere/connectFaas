const { getResponseJSON, setHeadersDomainRestricted, setHeaders, logIPAdddress } = require('./shared');

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

const notificationHandler = async (message) => {
    console.log("Message: " + message);

    const publishedMessage = message.data ? Buffer.from(message.data, 'base64').toString().trim() : null;
    const splitCharacters = '@#$'
    let html = ``;

    if(!/@#\$/.test(publishedMessage)) {
        const {PubSub} = require('@google-cloud/pubsub');
        const pubSubClient = new PubSub();
        const scheduleAt = publishedMessage;

        console.log(publishedMessage);

        const { getEmailNotifications } = require('./firestore');
        const notifications = await getEmailNotifications(scheduleAt);

        console.log(notifications);

        for(let notification of notifications) {
            const dataBuffer = Buffer.from(`${notification.id}${splitCharacters}250${splitCharacters}0`);
            try {
                const messageId = await pubSubClient.topic('connect-notifications').publish(dataBuffer);

                console.log(`Message ${messageId} published - ${notification.category} ${notification.attempt}`);

            } catch (error) {
                console.error(`Received error while publishing: ${error.message}`);
            }
        }
        return;
    }
    const messageArray = publishedMessage ? publishedMessage.split(splitCharacters) : null;

    const notificationId = messageArray[0];
    const limit = parseInt(messageArray[1]);
    const offset = parseInt(messageArray[2]);

    console.log("Notification ID: " + notificationId);

    const { getNotification } = require('./firestore');
    const notification = await getNotification(notificationId);

    const conditions = notification.conditions;
    const messageBody = notification.email.body;
    const messageSubject = notification.email.subject;
    const emailField = notification.emailField;
    const firstNameField = notification.firstNameField;
    const preferredNameField = notification.preferredNameField;
    const primaryField = notification.primaryField;
    const day = notification.time.day;
    const hour = notification.time.hour;
    const minute = notification.time.minute;

    if (notification.category === `newsletter`) {
        html = messageBody;
    }
    else {
        const showdown  = require('showdown');
        const converter = new showdown.Converter();
        html = converter.makeHtml(messageBody);
    }  

    console.log("Conditions: " + JSON.stringify(conditions));
    console.log("Primary Field: " + primaryField);

    const { retrieveParticipantsByStatus } = require('./firestore');
    const participantData = await retrieveParticipantsByStatus(conditions, limit, offset);
    if(participantData.length === 0) return;

    console.log("Participants: " + participantData.length);

    let participantCounter = 0;
    for( let participant of participantData) {
        if(participant[emailField]) { // If email doesn't exists try sms.

            let primaryFieldValue;

            if((/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(primaryField))) {
                primaryFieldValue = primaryField;
            }
            else {
                primaryFieldValue = checkIfPrimaryFieldExists(participant, primaryField.split('.'));
                if(!primaryFieldValue) continue;
            }

            let d = new Date(primaryFieldValue);

            d.setDate(d.getDate() + day);
            d.setHours(d.getHours() + hour);
            d.setMinutes(d.getMinutes() + minute);

            const participantFirstName = preferredNameField && participant[preferredNameField] ? participant[preferredNameField] : participant[firstNameField]

            let body = html.replace('<firstName>', participantFirstName);
            body = body.replace('${token}', participant['token'])

            if(body.indexOf('<loginDetails>') !== -1) {
                let loginDetails;
                
                if(participant[995036844] === 'phone' && participant[348474836]) {
                    loginDetails = participant[348474836];
                    loginDetails = `You may sign in to MyConnect app using ` + redactPhoneLoginInfo(loginDetails) + `.`;
                }
                else if(participant[995036844] === 'password' && participant[421823980]) {
                    loginDetails = participant[421823980];
                    loginDetails = `You may sign in to MyConnect app using ` + redactEmailLoginInfo(loginDetails) + `.`
                }
                else if(participant[995036844] === 'passwordAndPhone' && participant[421823980] && participant[348474836]) {
                    let emailLoginDetails = participant[421823980];
                    let phoneLoginDetails = participant[348474836];
                    
                    emailLoginDetails = redactEmailLoginInfo(emailLoginDetails)
                    phoneLoginDetails = redactPhoneLoginInfo(phoneLoginDetails);

                    loginDetails = `You may sign in to MyConnect app using ` + emailLoginDetails + ` or ` + phoneLoginDetails + `.`
                }
                else continue;

                body = body.replace('<loginDetails>', loginDetails);
            }

            const uuid = require('uuid');

            let reminder = {
                notificationSpecificationsID: notificationId,
                id: uuid(),
                notificationType: notification.notificationType[0],
                email: participant[emailField],
                notification : {
                    title: messageSubject,
                    body: body,
                    time: new Date().toISOString()
                },
                attempt: notification.attempt,            
                category: notification.category,
                token: participant.token,
                uid: participant.state.uid,
                read: false
            }

            // Check if same notifications has already been sent
            const { notificationAlreadySent } = require('./firestore');
            const sent = await notificationAlreadySent(reminder.token, reminder.notificationSpecificationsID);

            const currentDate = new Date();

            if(sent === false && d <= currentDate) {
                const { storeNotifications } = require('./firestore');
                await storeNotifications(reminder);

                sendEmail(participant[emailField], messageSubject, body);
            }
        }
        
        if(participantCounter === participantData.length - 1  && participantData.length === limit){ // paginate and publish message
            const {PubSub} = require('@google-cloud/pubsub');
            const pubSubClient = new PubSub();
            const dataBuffer = Buffer.from(`${notificationId}${splitCharacters}${limit}${splitCharacters}${offset+limit}`);
            try {
                const messageId = await pubSubClient.topic('connect-notifications').publish(dataBuffer);

                console.log(`Message ${messageId} published - ${notification.category} ${notification.attempt}`);

            } catch (error) {
                console.error(`Received error while publishing: ${error.message}`);
            }
        }
        participantCounter++;
    }
    return true;
}

const checkIfPrimaryFieldExists = (obj, primaryField) => {
    if(primaryField.length === 0) {
      return obj;
    }
    const key = primaryField[0];
    if(!obj[key]) return null;
    const response = checkIfPrimaryFieldExists(obj[key], primaryField.slice(1));
    return response;
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