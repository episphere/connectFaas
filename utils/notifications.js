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
    const specifications = await getNotificationSpecifications('email');
    for(let obj of specifications) {
        const conditions = obj.conditions;
        console.log(conditions)
        const { retrieveParticipantsByStatus } = require('./firestore');
        console.log(await retrieveParticipantsByStatus(conditions))
    }
    return res.status(200).json({code:200, message: 'ok'})
    
    
    
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey('');
    // const msg = {
    //     to: 'bhaumik7230@gmail.com',
    //     from: 'bhaumik55231@gmail.com',
    //     subject: 'Thanks for participating in Connect Cohort Study',
    //     text: 'Thanks for participating in Connect Cohort Study',
    //     html: '<strong>Connect Support Team</strong></br></br>',
    // };
    // sgMail.send(msg).then(() => {
    //     console.log('Email sent')
    // })
    // .catch((error) => {
    //     console.error(error)
    // });
    
}

module.exports = {
    subscribeToNotification,
    retrieveNotifications,
    notificationHandler
}