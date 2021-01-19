// Run locally
// const admin = require('firebase-admin');
// admin.initializeApp();
// const db = admin.firestore();
// const storage = admin.storage();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const increment = admin.firestore.FieldValue.increment(1);

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
        data['230663853'] = 353358909;
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

const incrementCounter = async (field, siteCode) => {
    const snapShot = await db.collection('stats').where('siteCode', '==', siteCode).get();
    let obj = {}
    obj[field] = increment;
    await db.collection('stats').doc(snapShot.docs[0].id).update(obj);
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
        const snapShot = await db.collection('participants').where('state.studyId', '==', studyId).where('827220437', '==', siteCode).get();
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

const getParticipantData = async (token, siteCode) => {
    try{
        const snapShot = await db.collection('participants')
                                .where('token', '==', token)
                                .where('827220437', '==', siteCode)
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
                                    .where('827220437', operator, siteCode)
                                    .where('821247024', '==', 197316935)
                                    .where('699625233', '==', 353358909)
                                    .get();
        }
        if(decider === 'notyetverified') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .where('821247024', '==', 875007964)
                                    .where('699625233', '==', 353358909)
                                    .get();
        }
        if(decider === 'cannotbeverified') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .where('821247024', '==', 219863910)
                                    .where('699625233', '==', 353358909)
                                    .get();
        }
        if(decider === 'profileNotSubmitted') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 353358909)
                                    .get()
        }
        if(decider === 'consentNotSubmitted') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 104430631)
                                    .where('230663853', '==', 353358909)
                                    .get()
        }
        if(decider === 'notSignedIn') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 104430631)
                                    .where('230663853', '==', 104430631)
                                    .get()
        }
        if(decider === 'all') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .orderBy("821247024", "asc")
                                    .get();
        }
        if(decider === 'stats') {
            participants = await db.collection('participants')
                                    .where('827220437', operator, siteCode)
                                    .orderBy("821247024", "asc")
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
            let concept;
            if(type === 'verified') {
                concept = 197316935;
                data['512820379'] = 486306141; // Active recruit
            }
            if(type === 'cannotbeverified') concept = 219863910;
            if(type === 'duplicate') concept = 922622075;
            if(type === 'outreachtimedout') concept = 160161595;

            data['821247024'] = concept;
            data['914594314'] = new Date().toISOString();
            
            await db.collection('participants').doc(docId).update(data);
            return true;
        }
        else {
            return new Error('Invalid token!');
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
        const data = await db.collection('participants').where('827220437', '==', siteCode).get();
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

const filterDB = async (queries, siteCode, isParent) => {
    try{
        const operator = isParent ? 'in' : '==';
        let query = db.collection('participants');
        for(let key in queries) {
            if(key === 'firstName' || key === 'lastName') query = query.where(`query.${key}`, '==', queries[key].toLowerCase());
            if(key === 'email' || key === 'phone') query = query.where(`${key === 'email' ? `query.allEmails` : `query.allPhoneNo`}`, 'array-contains', queries[key].toLowerCase());
            if(key === 'dob') query = query.where('371067537', '==', queries[key]);
            if(key === 'connectId') query = query.where('Connect_ID', '==', parseInt(queries[key]));
            if(key === 'token') query = query.where('token', '==', queries[key]);
            if(key === 'studyId') query = query.where('state.studyId', '==', queries[key]);
        }
        const snapshot = await query.where('827220437', operator, siteCode).get();
        if(snapshot.size !== 0){
            return snapshot.docs.map(document => document.data());
        }
        else{
            return [];
        }
    }
    catch(error){
        return new Error(error);
    }
}

const validateBiospecimenUser = async (email) => {
    try {
        const snapshot = await db.collection('biospecimenUsers').where('email', '==', email).get();
        if(snapshot.size === 1) {
            const role = snapshot.docs[0].data().role;
            const siteCode = snapshot.docs[0].data().siteCode;
            const response = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
            const siteAcronym = response.docs[0].data().acronym;
            return { role, siteCode, siteAcronym };
        }
        else return false;
    } catch (error) {
        return new Error(error);
    }
}

const biospecimenUserList = async (siteCode, email) => {
    try {
        let query = db.collection('biospecimenUsers').where('siteCode', '==', siteCode)
        if(email) query = query.where('addedBy', '==', email)
        const snapShot = await query.orderBy('role').orderBy('email').get();
        if(snapShot.size !== 0){
            return snapShot.docs.map(document => document.data());
        }
        else{
            return [];
        }
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const biospecimenUserExists = async (email) => {
    try {
        const snapshot = await db.collection('biospecimenUsers').where('email', '==', email).get();
        if(snapshot.size === 0) return false;
        else return true;
    } catch (error) {
        return new Error(error);
    }
}

const addNewBiospecimenUser = async (data) => {
    try {
        await db.collection('biospecimenUsers').add(data);
    } catch (error) {
        return new Error(error);
    }
}

const removeUser = async (userEmail, siteCode, email, manager) => {
    try {
        let query = db.collection('biospecimenUsers').where('email', '==', userEmail).where('siteCode', '==', siteCode);
        if(manager) query = query.where('addedBy', '==', email);
        const snapshot = await query.get();
        if(snapshot.size === 1) {
            console.log('Removing', userEmail);
            const docId = snapshot.docs[0].id;
            await db.collection('biospecimenUsers').doc(docId).delete();
            return true;
        }
        else return false;
    } catch (error) {
        return new Error(error);
    }
}

const storeSpecimen = async (data) => {
    await db.collection('biospecimen').add(data);
}


const storeBox = async (data) => {
    await db.collection('boxes').add(data);
}

const removeBag = async (institute, requestData) => {
    let boxId = requestData.boxId;
    let bags = requestData.bags;
    let currDate = requestData.date;    
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('siteAcronym', '==',institute).get();
    if(snapshot.size === 1){
        let box = snapshot.docs[0];
        let data = box.data()
        let currBags = data.bags;
        let bagIds = Object.keys(currBags);
        for(let i = 0; i < bags.length; i++){
            if(currBags.hasOwnProperty(bags[i])){
                delete currBags[bags[i]]
            }
            else{
                console.log(bags[i] + ' NOT FOUND')
            }
            
        }
        const docId = snapshot.docs[0].id;
        await db.collection('boxes').doc(docId).set(data);
        await db.collection('boxes').doc(docId).update({'lastUpdatedTiime':currDate})
        return 'Success!';
    }
    else{
        return 'Failure! Could not find box mentioned';
    }
}

const reportMissingSpecimen = async (siteAcronym, requestData) => {

    let tube = requestData.tubeId;
    if(tube.split(' ').length < 2){
        return 'Failure! Could not find tube mentioned';
    }
    let masterSpecimenId = tube.split(' ')[0];
    let tubeId = tube.split(' ')[1];
    let conversion = {
        "0007": "143615646",
        "0009": "223999569",
        "0012": "232343615",
        "0001": "299553921",
        "0011": "376960806",
        "0004": "454453939",
        "0021": "589588440",
        "0005": "652357376",
        "0032": "654812257",
        "0014": "677469051",
        "0024": "683613884",
        "0002": "703954371",
        "0022": "746999767",
        "0008": "787237543",
        "0003": "838567176",
        "0031": "857757831",
        "0013": "958646668",
        "0006": "973670172"
    }
    let conceptTube = conversion[tubeId];

    const snapshot = await db.collection('biospecimen').where('820476880', '==', masterSpecimenId).where('siteAcronym', '==', siteAcronym).get();
    if(snapshot.size === 1 && conceptTube != undefined){
        const docId = snapshot.docs[0].id;
        let currDoc = snapshot.docs[0].data();
        //find id before updating
        let keys = Object.keys(currDoc)
        /*for(let i = 0; i < keys.length; i++){
            if(keys[i].match(/tube[0-9]+Id/)){
                if(currDoc[keys[i]] == tubeId){
                    let currTubeNum = keys[i].match(/[0-9]+/g)[0];
                    let toUpdate = {};
                    toUpdate['tube' + currTubeNum + 'Missing'] = true;
                    await db.collection('biospecimen').doc(docId).update(toUpdate);
                    return 'Success!'
                }
            }
        }*/
        if(currDoc.hasOwnProperty(conceptTube)){
            let currObj = currDoc[conceptTube];
            currObj['258745303'] = '353358909';
            //let toUpdate = {conceptTube: currObj};
            let toUpdate = {};
            toUpdate[conceptTube] = currObj;
            await db.collection('biospecimen').doc(docId).update(toUpdate);
        }
    }
    else{
        return 'Failure! Could not find tube mentioned';
    }

}

const searchSpecimen = async (masterSpecimenId, siteCode) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', masterSpecimenId).get();
    if(snapshot.size === 1) {
        const token = snapshot.docs[0].data().token;
        const response = await db.collection('participants').where('token', '==', token).get();
        const participantSiteCode = response.docs[0].data()['827220437'];
        if(participantSiteCode === siteCode) return snapshot.docs[0].data();
        else return false;
    }
    else return false;
}

const searchShipments = async (siteAcronym) => {
    const snapshot = await db.collection('biospecimen').where('siteAcronym', '==', siteAcronym).get();
    if(snapshot.size !== 0){
        //
        return snapshot.docs.filter(document => {
            
            let data = document.data();
            let keys = Object.keys(data);
            let found = false;
            const conversion = {
                "299553921":"0001",
                "703954371":"0002",
                "838567176":"0003",
                "454453939":"0004",
                "652357376":"0005",
                "973670172":"0006",
                "143615646":"0007",
                "787237543":"0008",
                "223999569":"0009",
                "376960806":"0011",
                "232343615":"0012",
                "589588440":"0021",
                "746999767":"0022",
                "857757831":"0031",
                "654812257":"0032",
                "958646668":"0013",
                "677469051":"0014",
                "683613884":"0024"
            }
            for(let i = 0; i < keys.length; i++){
                if(conversion.hasOwnProperty(keys[i])){
                   
                    let currJSON = data[keys[i]]; 
                    if(currJSON.hasOwnProperty('258745303')){
                        if(currJSON['258745303'] == '104430631'){
                            return true;
                        }
                        found = true;
                    }
                    else if(currJSON.hasOwnProperty('145971562')){
                        if(currJSON['145971562'] == '104430631'){
                            found = true;
                        }
                        found = true;
                    }
                    else{
                        return true;
                    }
                }
            }
            if(found == false){
                return true;
            }
            else{
                return false;
            }
        }).map(document => document.data());
    }
    else{
        return [];
    }
}


const specimenExists = async (id, data) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', id).get();
    if(snapshot.size === 1) {
        const docId = snapshot.docs[0].id;
        await db.collection('biospecimen').doc(docId).update(data);
        return true;
    }
    else return false;
}

const boxExists = async (boxId, institute, data) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('siteAcronym', '==',institute).get();
    if(snapshot.size === 1) {
        const docId = snapshot.docs[0].id;
        await db.collection('boxes').doc(docId).set(data);
        return true;
    }
    else{
        return false;
    }
}

const updateTempCheckDate = async (institute) => {
    let currDate = new Date();
    let randomStart = Math.floor(Math.random()*5)+15 - currDate.getDay();
    currDate.setDate(currDate.getDate() + randomStart);
    const snapshot = await db.collection('SiteLocations').where('Site', '==',institute).get();
    if(snapshot.size === 1) {
        const docId = snapshot.docs[0].id;
        await db.collection('SiteLocations').doc(docId).update({'nextTempMonitor':currDate.toString()});
        //console.log(currDate.toString());
    }

}

const shipBox = async (boxId, institute, shippingData, trackingNumbers) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('siteAcronym', '==',institute).get();
    if(snapshot.size === 1) {
        let currDate = new Date();
        shippingData['656548982'] = Date.parse(currDate);
        shippingData['145971562'] = '353358909';
        shippingData['959708259'] = trackingNumbers[boxId]
        const docId = snapshot.docs[0].id;
        await db.collection('boxes').doc(docId).update(shippingData);
        

        let data = snapshot.docs[0].data();
        let bags = data.bags;
        let bagIds = Object.keys(data.bags);

        for(let i = 0; i < bagIds.length; i++){
            //get tubes under current bag master specimen
            let currBag = bagIds[i]
            let currArr = bags[currBag]['arrElements'];
            let currSpecimen = currBag.split(' ')[0];
            let response = {}
            //get currspecimen
            const snapshot1 = await db.collection('biospecimen').where('820476880', '==', currSpecimen).get();
            if(snapshot1.size === 1) {
                let thisdata = snapshot1.docs[0].data();
                if(thisdata['siteAcronym'] == institute){
                    response = thisdata;
                }
            }

            let conversion = {
                "0007": "143615646",
                "0009": "223999569",
                "0012": "232343615",
                "0001": "299553921",
                "0011": "376960806",
                "0004": "454453939",
                "0021": "589588440",
                "0005": "652357376",
                "0032": "654812257",
                "0014": "677469051",
                "0024": "683613884",
                "0002": "703954371",
                "0022": "746999767",
                "0008": "787237543",
                "0003": "838567176",
                "0031": "857757831",
                "0013": "958646668",
                "0006": "973670172"
            }
            for(let k = 0; k < currArr.length; k++){
                let currElement = currArr[k];
                let currId = currElement.split(' ')[1]
                let conceptTube = conversion[currId];
                if(response.hasOwnProperty(conceptTube)){
                    let currObj = response[conceptTube];
                    currObj['145971562'] = '353358909'
                }

            }
            console.log(await specimenExists(currSpecimen, response));
        }
        return true;
    }
    else{
        return false;
    }
}

const getLocations = async (institute) => {
    const snapshot = await db.collection('SiteLocations').where('siteAcronym', '==', institute).get();
    console.log(institute)
    if(snapshot.size !== 0) {
        return snapshot.docs.map(document => document.data());
    }
    else{
        return [];
    }


}

const searchBoxes = async (institute) => {
    const snapshot = await db.collection('boxes').where('siteAcronym', '==', institute).get();
    if(snapshot.size !== 0){
        return snapshot.docs.map(document => document.data());
    }
    else{
        return [];
    }
}

const searchBoxesByLocation = async (institute, location) => {
    const snapshot = await db.collection('boxes').where('siteAcronym', '==', institute).where('560975149','==',location).get();
    if(snapshot.size !== 0){
        let result = snapshot.docs.map(document => document.data());
        console.log(JSON.stringify(result));
        let toReturn = result.filter(data => (!data.hasOwnProperty('145971562')||data['145971562']!='353358909'))
        return toReturn;
    }
    else{
        return [];
    }
    
}

const getSpecimenCollections = async (token, siteAcronym) => {
    const snapshot = await db.collection('biospecimen').where('token', '==', token).where('siteAcronym', '==', siteAcronym).get();
    if(snapshot.size !== 0){
        return snapshot.docs.map(document => document.data());
    }
    else{
        return false;
    }
}

const getBoxesPagination = async (institute, body) => {
    let currPage = body.pageNumber;
    let orderByField = body.orderBy;
    let elementsPerPage = body.elementsPerPage;
    let filters = body.filters;

    let startDate = 0;
    let trackingId = '';
    let endDate = 0;
    if(filters !== undefined){
        if(filters.hasOwnProperty('startDate')){
            startDate = filters['startDate']
        }
        if(filters.hasOwnProperty('trackingId')){
            trackingId = filters['trackingId'];
        }
        if(filters.hasOwnProperty('endDate')){
            endDate = filters['endDate']
        }
    }
    let snapshot;
    if(trackingId !== ''){
        if(endDate !== 0){
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '<=', endDate).where('656548982', '>=', startDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '<=', endDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
        }
        else{
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '>=', startDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
        }
    }
    else{
        if(endDate !== 0){
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', "<=", endDate).where('656548982' ,">=", startDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', "<=", endDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
        }
        else{
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', ">=", startDate).orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
            }
        }
    }

    
    //const snapshot = await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage*elementsPerPage).get();
    let result = snapshot.docs.map(document => document.data());
    return result;
    /*if(snapshot.size !== 0){
        
        let arrSnaps = snapshot.docs;
        let toStart = currPage * elementsPerPage;
        let toReturnArr = snapshot.splice(toStart, toStart+25 > arrSnaps.length? arrSnaps.length : tStart + 25);
        let toReturn = [toReturnArr, Math.ceil(arrSnaps.length)]
        return toReturn;
    }
    else{
        return [[],0]
    }*/

    
}

const getNumBoxesShipped = async (institute, body) => {
    let filters = body;

    let startDate = 0;
    let trackingId = '';
    let endDate = 0;
    if(filters.hasOwnProperty('startDate')){
        startDate = filters['startDate']
    }
    
    if(filters.hasOwnProperty('trackingId')){
        trackingId = filters['trackingId'];
    }
    if(filters.hasOwnProperty('endDate')){
        endDate = filters['endDate']
    }
    let snapshot = {'docs':[]};
    if(trackingId !== ''){
        if(endDate !== 0){
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '<=', endDate).where('656548982', '>=', startDate).orderBy('656548982', 'desc').get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '<=', endDate).orderBy('656548982', 'desc').get();
            }
        }
        else{
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).where('656548982', '>=', startDate).orderBy('656548982', 'desc').get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('959708259', '==', trackingId).orderBy('656548982', 'desc').get();
            }
        }
    }
    else{
        if(endDate !== 0){
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', '<=', endDate).where('656548982', '>=', startDate).orderBy('656548982', 'desc').get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', '<=', endDate).orderBy('656548982', 'desc').get();
            }
        }
        else{
            if(startDate !== 0){
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').where('656548982', '>=', startDate).orderBy('656548982', 'desc').get();
            }
            else{
                snapshot =  await db.collection('boxes').where('siteAcronym', '==', institute).where('145971562','==','353358909').orderBy('656548982', 'desc').get();
            }
        }
    }
    
    let result = snapshot.docs.length;
    return result;
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
    getParticipantData,
    updateParticipantData,
    storeNotificationTokens,
    notificationTokenExists,
    retrieveUserNotifications,
    getGCSbucket,
    storeUploadedFileDetails,
    filterDB,
    validateBiospecimenUser,
    biospecimenUserList,
    biospecimenUserExists,
    addNewBiospecimenUser,
    removeUser,
    storeSpecimen,
    searchSpecimen,
    searchShipments,
    specimenExists,
    boxExists,
    storeBox,
    searchBoxes,
    shipBox,
    getLocations,
    searchBoxesByLocation,
    removeBag,
    reportMissingSpecimen,
    updateTempCheckDate,
    getSpecimenCollections,
    getBoxesPagination,
    getNumBoxesShipped,
    incrementCounter
}