// const admin = require('firebase-admin');
// admin.initializeApp({
//     credential: admin.credential.applicationDefault(),
// });
// const firestore = require('@google-cloud/firestore');
// const db = new firestore({
//     credential: admin.credential.applicationDefault(),
// });
// const { Storage } = require('@google-cloud/storage');
// const storage = new Storage({
//     credential: admin.credential.applicationDefault(),
// });

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const storage = admin.storage();

const validateKey = async (access_token) => {
    try{
        const response = await db.collection('apiKeys').where('access_token', '==', access_token).get();
        
        if(response.size !== 0) {
            const expiry = response.docs[0].data().expires.toDate().getTime();
            const currentTime = new Date().getTime();
            if(expiry > currentTime){
                return true;
            }
            else{
                return false;
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    } 
}

const authorizeToken = async(token) => {
    try{
        const response = await db.collection('apiKeys').where('token', '==', token).get();
        if(response.size > 0) {
            for(let doc of response.docs){
                const expiry = doc.data().expires.toDate().getTime();
                const currentTime = new Date().getTime();
                
                if(expiry > currentTime){
                    return {access_token: doc.data().access_token, expires: doc.data().expires.toDate()}
                }
                else{
                    const uuid = require('uuid');
                    const data = {
                        access_token: uuid(),
                        expires: new Date(Date.now() + 3600000)
                    }
                    await db.collection('apiKeys').doc(doc.id).update(data);
                    return data;
                }
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const verifyToken = async (token) => {
    try{
        const response = await db.collection('participants').where('token', '==', token).get();
        if(response.size === 1) {
            if(response.docs[0].data().state.uid === undefined){
                return response.docs[0].id;
            }else{
                return false;
            }
        }
        return false;
    }
    catch(error){
        return new Error(error);
    }
}

const verifyPin = async (pin) => {
    try{
        const response = await db.collection('participants').where('pin', '==', pin).get();
        if(response.size === 1) {
            if(response.docs[0].data().state.uid === undefined){
                return response.docs[0].id;
            }else{
                return false;
            }
        }
        return false;
    }
    catch(error){
        return new Error(error);
    }
}

const validateIDToken = async (idToken) => {
    try{
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    }
    catch(error){
        return new Error(error);
    }
}

const linkParticipanttoFirebaseUID = async (docID, uID) => {
    try{
        let data = {};
        data['state.RcrtSI_Account_v1r0'] = 1;
        data['state.uid'] = uID
        await db.collection('participants').doc(docID).update(data);
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const participantExists = async (uid) => {
    try{
        const response = await db.collection('participants').where('state.uid', '==', uid).get();
        if(response.size === 0){
            return false;
        }
        else{
            return true;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const storeResponse = async (data) => {
    try{
        const response = await db.collection('participants').where('state.token', '==', data.token).get();
        if(response.size > 0) {
            const latestVersion = response.docs.reduce((max, record) => record.data().version > max ? record.data().version : max, 0);
            data.version = latestVersion + 1;
            await db.collection('participants').add(data);
            return true;
        }
        else{
            data.version = 1;
            await db.collection('participants').add(data);
            return true;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const updateResponse = async (data, uid) => {
    try{
        const response = await db.collection('participants').where('state.uid', '==', uid).get();
        if(response.size === 1) {
            for(let doc of response.docs){
                await db.collection('participants').doc(doc.id).update(data);
                return true;
            }
        }
    }
    catch(error){
        return new Error(error)
    }
}

const storeAPIKeyandToken = async (data) => {
    try{
        await db.collection('apiKeys').add(data);
        await db.collection('participants').add({state: {token: data.token, verified: false, identityClaimDeniedBySite: false}});
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const createRecord = async (data) => {
    try{
        await db.collection('participants').add(data);
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const recordExists = async (studyId, siteCode) => {
    try{
        const snapShot = await db.collection('participants').where('state.studyId', '==', studyId).where('RcrtES_Site_v1r0', '==', siteCode).get();
        if(snapShot.size === 1){
            return snapShot.docs[0].data();
        }
        else {
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const pinExists = async (pin) => {
    try{
        const snapShot = await db.collection('participants').where('pin', '==', pin).get();
        if(snapShot.size === 1){
            return snapShot.docs[0].data();
        }
        else {
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const retrieveQuestionnaire = async (source) => {
    try{
        const data = await db.collection('questionnaire').where('source', '==', source).orderBy('sequence').get();
        if(data.size !== 0){
            return data.docs.map(document => document.data());
        }
        else{
            return new Error(`No questions found for source ${source}`);
        }
    }
    catch(error){
        return new Error(error);
    }
}

const validateSiteUser = async (siteKey) => {
    try{
        const snapShot = await db.collection('siteDetails')
                                .where('siteKey', '==', siteKey)
                                .get();
        if(snapShot.size === 1) {
            return snapShot.docs[0].data();
        }
        else{
            return false;
        };
    }
    catch(error){
        return new Error(error);
    }
}

const storeParticipantData = async (token, siteCode) => {
    try{
        const snapShot = await db.collection('participants')
                                .where('token', '==', token)
                                .where('RcrtES_Site_v1r0', '==', siteCode)
                                .get();
        if(snapShot.size === 1) {
            return {id: snapShot.docs[0].id, data: snapShot.docs[0].data()};
        }
        else{
            return false;
        };
    }
    catch(error){
        return new Error(error);
    }
}

const updateParticipantData = async (id, data) => {
    await db.collection('participants')
            .doc(id)
            .update(data);
}

const retrieveParticipants = async (siteCode, decider, isParent) => {
    try{
        const operator = isParent ? 'in' : '==';
        let participants = {};
        if(decider === 'verified') {
            participants = await db.collection('participants')
                                    .where('RcrtES_Site_v1r0', operator, siteCode)
                                    .where('state.RcrtV_Verification_v1r0', '==', 1)
                                    .where('RcrtUP_Submitted_v1r0', '==', 1)
                                    .get();
        }
        if(decider === 'notyetverified') {
            participants = await db.collection('participants')
                                    .where('RcrtES_Site_v1r0', operator, siteCode)
                                    .where('state.RcrtV_Verification_v1r0', '==', 0)
                                    .where('RcrtUP_Submitted_v1r0', '==', 1)
                                    .get();
        }
        if(decider === 'cannotbeverified') {
            participants = await db.collection('participants')
                                    .where('RcrtES_Site_v1r0', operator, siteCode)
                                    .where('state.RcrtV_Verification_v1r0', '==', 2)
                                    .where('RcrtUP_Submitted_v1r0', '==', 1)
                                    .get();
        }
        if(decider === 'all') {
            participants = await db.collection('participants')
                                    .where('RcrtES_Site_v1r0', operator, siteCode)
                                    .orderBy("state.RcrtV_Verification_v1r0", "asc")
                                    .get();
        }
        return participants.docs.map(document => {
            let data = document.data();
            return data;
        });
    }
    catch(error){
        return new Error(error);
    }
}

const getChildrens = async (ID) => {
    try{
        const snapShot = await db.collection('siteDetails')
                                .where('state.parentID', 'array-contains', ID)
                                .get();
        if(snapShot.size > 0) {
            const siteCodes = [];
            snapShot.docs.map(document => {
                if(document.data().siteCode){
                    siteCodes.push(document.data().siteCode);
                }
            });
            return siteCodes;
        }
        else{
            return false;
        };
    }
    catch(error){
        return new Error(error);
    }
}

const verifyIdentity = async (type, token) => {
    try{
        const snapShot = await db.collection('participants')
                                .where('token', '==', token)
                                .get();
        if(snapShot.size > 0){
            const docId = snapShot.docs[0].id;
            let data = {};
            if(type){
                data['RcrtSI_RecruitType_v1r0'] = 1; // Active recruit
                data['state.RcrtV_Verification_v1r0'] = 1;
            }
            else{
                data['state.RcrtV_Verification_v1r0'] = 2;
            }
            await db.collection('participants').doc(docId).update(data);
            return true;
        }
        else {
            return new Error('Record corresponding to token not found!!');
        }
    }
    catch(error){
        return new Error(error);
    }
}

const retrieveSiteDetails = async () => {
    try{
        const snapShot = await db.collection('siteDetails').orderBy('siteCode').get();
        if(snapShot.size > 0){
            return snapShot.docs.map(document => {
                return {
                    siteName: document.data().siteName,
                    siteCode: document.data().siteCode
                }
            });
        }
        else{
            return new Error('No site details found!')
        }
    }
    catch(error){
        return new Error(error)
    }
}

const retrieveUserProfile = async (uid) => {
    try{
        const snapShot = await db.collection('participants')
                                .where('state.uid', '==', uid)
                                .get();
        if(snapShot.size > 0){
            return snapShot.docs.map(document => {
                let data = document.data();
                delete data.state;
                return data;
            });
        }
        else{
            return new Error('No record found!')    
        }
    }
    catch(error){
        return new Error(error)
    }
}

const retrieveToken = async (access_token) => {
    try{
        const response = await db.collection('apiKeys')
                                .where('access_token', '==', access_token)
                                .get();
        if(response.size > 0) {
            const data = response.docs[0].data();
            const expiry = data.expires.toDate().getTime();
            const currentTime = new Date().getTime();
            if(expiry > currentTime){
                return {token: data.token, docId: response.docs[0].id};
            }
            else{
                return false;
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const storeCredentials = async (access_token, email, hash) => {
    try{
        const { token, docId } = await retrieveToken(access_token);
        if(!token) return false;

        const accountExists = await db.collection('participants').where('state.email', '==', email).get();
        if(accountExists.size > 0) return new Error(`Account with email ${email} already exists!`)

        const snapShot = await db.collection('participants').where('state.token', '==', token).get();
        if(snapShot.size > 0){
            const id = snapShot.docs[0].id;
            const document = snapShot.docs[0].data();
            if(document.state.email){
                return new Error('Account already exists for this user');
            }

            const data = {
                'state.email': email,
                'state.password': hash
            }
            await db.collection('participants').doc(id).update(data);

            const uuid = require('uuid');
            const tokens = {
                access_token: uuid(),
                expires: new Date(Date.now() + 3600000),
                email: email
            }
            await db.collection('apiKeys').add(tokens);
            await db.collection('apiKeys').doc(docId).delete();
            return true;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const retrieveAccount = async (email, password) => {
    try {
        const snapshot = await db.collection('participants').where('state.email', '==', email).get();
        if(snapshot.size > 0 ){
            const hash = snapshot.docs[0].data().state.password;
            const bcrypt = require('bcrypt');
            const response = await bcrypt.compare(password, hash);
            if(!response) return new Error('Invalid password!');
            
            const authorize = await db.collection('apiKeys').where('email', '==', email).get();
            const id = authorize.docs[0].id;
            const data = authorize.docs[0].data();
            const expiry = data.expires.toDate().getTime();
            const currentTime = new Date().getTime();
            if(expiry > currentTime){
                return { access_token: data.access_token, expires: data.expires.toDate() };
            }
            else{
                const uuid = require('uuid');
                const data = {
                    access_token: uuid(),
                    expires: new Date(Date.now() + 3600000)
                }
                await db.collection('apiKeys').doc(id).update(data);
                return data;
            }
        }
        else{
            return new Error('Invalid Email!')
        }
    }
    catch(error){
        return new Error(error);
    }
}

const storeFile = async (subission, filename, encoding, mimetype) => {
    try{
        const uuid = require('uuid');
        const myBucket = gcs.bucket('connect-cohort-submisssions-dev');
        const gcsname = Date.now() + `${uuid()}_${filename}`;
        const file = myBucket.file(gcsname);
        await file.save(subission);
        // const stream = file.createWriteStream({
        //     metadata: {
        //         contentType: mimetype
        //     },
        //     resumable: false
        // });

        // stream.on('error', (err) => {
        //     req.file.cloudStorageError = err;
        //     next(err);
        // });
    
        // stream.on('finish', () => {
        //     req.file.cloudStorageObject = gcsname;
        //     next();
        // });
    
        // stream.end(subission);
    }
    catch(error){
        return new Error(error)
    }
}

const sanityCheckConnectID = async (ID) => {
    try{
        const snapshot = await db.collection('participants').where('Connect_ID', '==', ID).get();
        if(snapshot.size === 0) return true;
        else return false;
    }
    catch(error){
        return new Error(error);
    }
}

const sanityCheckPIN = async (pin) => {
    try{
        const snapshot = await db.collection('participants').where('pin', '==', pin).get();
        if(snapshot.size === 0) return true;
        else return false;
    }
    catch(error){
        return new Error(error);
    }
}

const individualParticipant = async (key, value) => {
    try {
        const snapshot = await db.collection('participants').where(key, '==', value).get();
        if(snapshot.size > 0) {
            return snapshot.docs.map(document => {
                let data = document.data();
                return data;
            });
        }
        else return false;
    }
    catch(error) {
        return new Error(error);
    }
}

const deleteFirestoreDocuments = async (siteCode) => {
    try{
        const data = await db.collection('participants').where('RcrtES_Site_v1r0', '==', siteCode).get();
        if(data.size !== 0){
            data.docs.forEach(async dt =>{ 
                await db.collection('participants').doc(dt.id).delete()
            })
        }
    }
    catch(error){
        return new Error(error);
    }
}

const storeNotificationTokens = (data) => {
    db.collection('notificationRegistration')
        .add(data);
}

const notificationTokenExists = async (token) => {
    const snapShot = await db.collection('notificationRegistration')
                            .where('notificationToken', '==', token)
                            .get();
    if(snapShot.size === 1){
        return snapShot.docs[0].data().uid;
    }
    else {
        return false;
    }
}

const retrieveUserNotifications = async (uid) => {
    const snapShot = await db.collection('notifications')
                            .where('uid', '==', uid)
                            .orderBy('notification.time', 'desc')
                            .get();
    if(snapShot.size > 0){
        return snapShot.docs.map(document => {
            let data = document.data();
            return data;
        });
    }
    else {
        return false;
    }
}

const getGCSbucket = () => {
    const bucket = storage.bucket('connect4cancer');
    return bucket;
}

const storeUploadedFileDetails = async (obj) => {
    await db.collection('fileuploads').add(obj);
}

module.exports = {
    validateKey,
    authorizeToken,
    storeAPIKeyandToken,
    retrieveQuestionnaire,
    updateResponse,
    validateSiteUser,
    retrieveParticipants,
    verifyIdentity,
    retrieveSiteDetails,
    retrieveUserProfile,
    storeCredentials,
    retrieveAccount,
    storeFile,
    createRecord,
    recordExists,
    pinExists,
    validateIDToken,
    verifyToken,
    verifyPin,
    linkParticipanttoFirebaseUID,
    participantExists,
    sanityCheckConnectID,
    sanityCheckPIN,
    individualParticipant,
    getChildrens,
    deleteFirestoreDocuments,
    storeParticipantData,
    updateParticipantData,
    storeNotificationTokens,
    notificationTokenExists,
    retrieveUserNotifications,
    getGCSbucket,
    storeUploadedFileDetails
}