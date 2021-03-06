const { getResponseJSON, setHeadersDomainRestricted, setHeaders } = require('./shared');

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

const retrieveNotifications = async (req, res) => {
    setHeadersDomainRestricted(req, res)

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
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
    const uid = decodedToken.uid;
    const { retrieveUserNotifications } = require('./firestore');
    const notifications = await retrieveUserNotifications(uid);
    if(notifications !== false){
        markAllNotificationsAsAlreadyRead(notifications.map(dt => dt.id));
    }
    res.status(200).json({data: notifications === false ? [] : notifications, code:200})
}

const markAllNotificationsAsAlreadyRead = (notification) => {
    for(let id of notification) {
        if(id) {
            const {markNotificationAsRead} = require('./firestore');
            markNotificationAsRead(id);
        }
    }
}

const notificationHandler = async (message, context) => {
    const publishedMessage = message.data ? Buffer.from(message.data, 'base64').toString().split(',') : null;
    const notificationCategory = publishedMessage[0];
    let limit = parseInt(publishedMessage[1]);
    let offset = parseInt(publishedMessage[2]);
    console.log(limit);
    console.log(offset);
    // setHeaders(res);

    // if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    // if(req.method !== 'GET') {
    //     return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    // }

    const { getNotificationSpecifications } = require('./firestore');
    const notificationType = 'email';
    const specifications = await getNotificationSpecifications(notificationType, notificationCategory);
    let specCounter = 0;
    for(let obj of specifications) {
        const notificationSpecificationsID = obj.id;
        const conditions = obj.conditions;
        const messageBody = obj[notificationType].body;
        const messageSubject = obj[notificationType].subject;
        const emailField = obj.emailField;
        const firstNameField = obj.firstNameField;
        const phoneField = obj.phoneField;
        const primaryField = obj.primaryField;
        const day = obj.time.day;
        const hour = obj.time.hour;
        const minute = obj.time.minute;

        const showdown  = require('showdown');
        const converter = new showdown.Converter();
        const html = converter.makeHtml(messageBody);
        const uuid = require('uuid');

        const { retrieveParticipantsByStatus } = require('./firestore');
        const participantData = await retrieveParticipantsByStatus(conditions, limit, offset);
        let participantCounter = 0;
        for( let participant of participantData) {
            if(participant[emailField]) {
                let d = new Date(participant[primaryField]);
                d.setDate(d.getDate() + day);
                d.setHours(d.getHours() + hour);
                d.setMinutes(d.getMinutes() + minute);
                const body = html.replace('<firstName>', participant[firstNameField]);
                const currentDate = new Date();
                let reminder = {
                    notificationSpecificationsID,
                    id: uuid(),
                    notificationType,
                    email: participant[emailField],
                    notification : {
                        title: messageSubject,
                        body: body,
                        time: new Date().toISOString()
                    },
                    token: participant.token,
                    uid: participant.state.uid,
                    read: false
                }
                // Check if same notifications has already been sent
                const { notificationAlreadySent } = require('./firestore');
                const sent = await notificationAlreadySent(reminder.token, reminder.notificationSpecificationsID);
                
                if(sent === false && d <= currentDate) {
                    const { storeNotifications } = require('./firestore');
                    sendEmail(participant[emailField], messageSubject, body);
                    await storeNotifications(reminder);
                }
            }
            if(participantCounter === participantData.length - 1 && specCounter === specifications.length - 1 && participantData.length === limit){ // paginate and publish message
                const {PubSub} = require('@google-cloud/pubsub');
                const pubSubClient = new PubSub();
                const dataBuffer = Buffer.from(`${notificationCategory},${limit},${offset+limit}`);
                try {
                    const messageId = await pubSubClient.topic('connect-notifications').publish(dataBuffer);
                    console.log(`Message ${messageId} published.`);
                } catch (error) {
                    console.error(`Received error while publishing: ${error.message}`);
                }
            }
            participantCounter++;
        }
        specCounter++;
    }
    return true;
    // return res.status(200).json({code:200, message: 'ok'})
}

const sendSms = (phoneNo) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    client.messages
        .create({body: 'Thanks for joining Connect', from: process.env.from_phone_no, to: phoneNo})
        .then(message => console.log(message.sid));
}

const sendEmail = (emailTo, messageSubject, html) => {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.sg_email);
    const msg = {
        to: emailTo,
        from: 'bhaumik55231@gmail.com',
        subject: messageSubject,
        html: html,
    };
    sgMail.send(msg).then(() => {
        console.log('Email sent to '+emailTo)
    })
    .catch((error) => {
        console.error(error)
    });
}

module.exports = {
    subscribeToNotification,
    retrieveNotifications,
    notificationHandler
}