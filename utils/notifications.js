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
    res.status(200).json({data: notifications === false ? [] : notifications, code:200})
}

const notificationHandler = async (req, res) => {
    setHeaders(res);
    const { getNotificationSpecifications } = require('./firestore');
    const notificationType = 'email';
    const specifications = await getNotificationSpecifications(notificationType);
    for(let obj of specifications) {
        const notificationSpecificationsID = obj.id;
        const conditions = obj.conditions;
        const messageBody = obj.message.body;
        const messageSubject = obj.message.subject;
        const emailField = obj.emailField;
        const firstNameField = obj.firstNameField;
        const phoneField = obj.phoneField;
        const primaryField = obj.primaryField;
        const day = obj.time.day;
        const hour = obj.time.hour;
        const minute = obj.time.minute;

        const showdown  = require('showdown');
        const converter = new showdown.Converter();
        let html = converter.makeHtml(messageBody);
        const uuid = require('uuid');


        const { retrieveParticipantsByStatus } = require('./firestore');
        const participantData = await retrieveParticipantsByStatus(conditions);
        for( let participant of participantData) {
            if(participant[emailField]) {

                let d = new Date(participant[primaryField]);
                d.setDate(d.getDate() + day);
                d.setHours(d.getHours() + hour);
                d.setMinutes(d.getMinutes() + minute);
                
                const currentDate = new Date();
                let reminder = {
                    notificationSpecificationsID,
                    id: uuid(),
                    notificationType,
                    email: participant[emailField],
                    notification : {
                        title: messageSubject,
                        body: html,
                        time: new Date().toISOString()
                    },
                    token: participant.token,
                    uid: participant.state.uid
                }

                // Check if similar notifications has already been sent
                const { notificationAlreadySent } = require('./firestore');
                const sent = await notificationAlreadySent(reminder.token, reminder.notificationSpecificationsID);
                if(sent === false && d <= currentDate) {
                    const { storeNotifications } = require('./firestore');
                    await storeNotifications(reminder)
                    html = html.replace('<firstName>', participant[firstNameField]);
                    sendEmail(participant[emailField], messageSubject, html);
                }
            }
        }
    }
    return res.status(200).json({code:200, message: 'ok'})
}

const sendEmail = (emailTo, messageSubject, html) => {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey('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');
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