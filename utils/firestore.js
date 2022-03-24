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
const decrement = admin.firestore.FieldValue.increment(-1);
const { collectionIdConversion, sites  } = require('./shared');

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
        console.error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const validateIDToken = async (idToken) => {
    try{
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        return decodedToken;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const validateMultiTenantIDToken = async (idToken, tenant) => {
    try{
        const decodedToken = await admin.auth().tenantManager().authForTenant(tenant).verifyIdToken(idToken, true);
        return decodedToken;
    }
    catch(error){
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
        return new Error(error)
    }
}

const incrementCounter = async (field, siteCode) => {
    const snapShot = await db.collection('stats').where('siteCode', '==', siteCode).get();
    let obj = {}
    obj[field] = increment;
    await db.collection('stats').doc(snapShot.docs[0].id).update(obj);
}

const decrementCounter = async (field, siteCode) => {
    const snapShot = await db.collection('stats').where('siteCode', '==', siteCode).get();
    let obj = {}
    obj[field] = decrement;
    await db.collection('stats').doc(snapShot.docs[0].id).update(obj);
}

const createRecord = async (data) => {
    try{
        await db.collection('participants').add(data);
        return true;
    }
    catch(error){
        console.error(error);
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
        console.error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const validateSiteSAEmail = async (saEmail) => {
    try{
        const snapShot = await db.collection('siteDetails')
                                .where('saEmail', '==', saEmail)
                                .get();
        if(snapShot.size === 1) {
            return snapShot.docs[0].data();
        }
        else{
            return false;
        };
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const getParticipantData = async (token, siteCode, isParent) => {
    try{
        const operator = isParent ? 'in' : '==';
        const snapShot = await db.collection('participants')
                                .where('token', '==', token)
                                .where('827220437', operator, siteCode)
                                .get();
        if(snapShot.size === 1) {
            return {id: snapShot.docs[0].id, data: snapShot.docs[0].data()};
        }
        else{
            return false;
        };
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const updateParticipantData = async (id, data) => {
    await db.collection('participants')
            .doc(id)
            .update(data);
}

const retrieveParticipants = async (siteCode, decider, isParent, limit, page, site, from, to) => {
    try{
        const operator = isParent ? 'in' : '==';
        let participants = {};
        const offset = (page-1)*limit;
        if(decider === 'verified') {
            let query = db.collection('participants')
                            .where('821247024', '==', 197316935)
                            .where('699625233', '==', 353358909)
                            .orderBy("Connect_ID", "asc")
                            .limit(limit)
                            .offset(offset)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            participants = await query.get();
        }
        if(decider === 'notyetverified') {
            let query = db.collection('participants')
                                    .where('821247024', '==', 875007964)
                                    .where('699625233', '==', 353358909)
                                    .orderBy("Connect_ID", "asc")
                                    .offset(offset)
                                    .limit(limit)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent                       
            participants = await query.get();
        }
        if(decider === 'cannotbeverified') {
            let query = db.collection('participants')
                                    .where('821247024', '==', 219863910)
                                    .where('699625233', '==', 353358909)
                                    .orderBy("Connect_ID", "asc")
                                    .offset(offset)
                                    .limit(limit)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent                       
            participants = await query.get();
        }
        if(decider === 'profileNotSubmitted') {
            let query = db.collection('participants')
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 353358909)
                                    .orderBy("821247024", "asc")
                                    .offset(offset)
                                    .limit(limit)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent                       
            participants = await query.get();
        }
        if(decider === 'consentNotSubmitted') {
            let query = db.collection('participants')
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 104430631)
                                    .where('230663853', '==', 353358909)
                                    .orderBy("821247024", "asc")
                                    .offset(offset)
                                    .limit(limit)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent                       
            participants = await query.get();
        }
        if(decider === 'notSignedIn') {
            let query = db.collection('participants')
                                    .where('699625233', '==', 104430631)
                                    .where('919254129', '==', 104430631)
                                    .where('230663853', '==', 104430631)
                                    .orderBy("821247024", "asc")
                                    .offset(offset)
                                    .limit(limit)
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent                       
            participants = await query.get();
        }
        if(decider === 'all') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("471593703", "desc")
            query = query.orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent   
            if(from) query = query.where('471593703', '>=', from)
            if(to) query = query.where('471593703', '<=', to)
            participants = await query.get();
        }
        if(decider === 'active') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("471593703", "desc")
            query = query.where("512820379", "==", 486306141) // Recruit type active
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('471593703', '>=', from)
            if(to) query = query.where('471593703', '<=', to)
            participants = await query.get();
        }
        if(decider === 'notactive') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("471593703", "desc")
            query = query.where("512820379", "==", 180583933) // Recruit type not active
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('471593703', '>=', from)
            if(to) query = query.where('471593703', '<=', to)
            participants = await query.get();
        }
        if(decider === 'passive') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("471593703", "desc")
            query = query.where("512820379", "==", 854703046) // Recruit type passive
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('471593703', '>=', from)
            if(to) query = query.where('471593703', '<=', to)
            participants = await query.get();
        }
        return participants.docs.map(document => {
            let data = document.data();
            return data;
        });
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const retrieveParticipantsEligibleForIncentives = async (siteCode, roundType, isParent, limit, page) => {
    try {
        const operator = isParent ? 'in' : '==';
        const offset = (page-1)*limit;
        const { incentiveConcepts } = require('./shared');
        const object = incentiveConcepts[roundType]
        
        let participants = await db.collection('participants')
                                .where('827220437', operator, siteCode)
                                .where('821247024', '==', 197316935)
                                .where(`${object}.222373868`, "==", 353358909)
                                .where(`${object}.648936790`, '==', 104430631)
                                .where(`${object}.648228701`, '==', 104430631)
                                .orderBy('Connect_ID', 'asc')
                                .offset(offset)
                                .limit(limit)
                                .get();
                        

        return participants.docs.map(document => {
            let data = document.data();
            return {firstName: data['399159511'], email: data['869588347'], token: data['token']}
        });
    } catch (error) {
        console.error(error);
        return new Error(error)
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
        console.error(error);
        return new Error(error);
    }
}

const verifyIdentity = async (type, token, siteCode) => {
    try{
        const snapShot = await db.collection('participants')
                                .where('token', '==', token)
                                .where('827220437', '==', siteCode)
                                .get();
        if(snapShot.size > 0){
            const docId = snapShot.docs[0].id;
            const docData = snapShot.docs[0].data();
            const existingVerificationStatus = docData[821247024];
            const { conceptMappings } = require('./shared');
            const concept = conceptMappings[type];
            if([875007964, 160161595].indexOf(existingVerificationStatus) === -1) {
                console.log(`Verification status cannot be changed from ${existingVerificationStatus} to ${concept}`);
                return new Error(`Verification status cannot be changed from ${existingVerificationStatus} to ${concept}`);
            }

            let data = {};

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
        console.error(error);
        return new Error(error);
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
        console.error(error);
        return new Error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const sanityCheckConnectID = async (ID) => {
    try{
        const snapshot = await db.collection('participants').where('Connect_ID', '==', ID).get();
        if(snapshot.size === 0) return true;
        else return false;
    }
    catch(error){
        console.error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const individualParticipant = async (key, value, siteCode, isParent) => {
    try {
        const operator = isParent ? 'in' : '==';
        const snapshot = await db.collection('participants').where(key, '==', value).where('827220437', operator, siteCode).get();
        if(snapshot.size > 0) {
            return snapshot.docs.map(document => {
                let data = document.data();
                return data;
            });
        }
        else return false;
    }
    catch(error) {
        console.error(error);
        return new Error(error);
    }
}

const updateParticipantRecord = async (key, value, siteCode, isParent, obj) => {
    try {
        const operator = isParent ? 'in' : '==';
        const snapshot = await db.collection('participants').where(key, '==', value).where('827220437', operator, siteCode).get();
        const docId = snapshot.docs[0].id;
        await db.collection('participants').doc(docId).update(obj);
    }
    catch(error) {
        console.error(error);
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
        console.error(error);
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
    try {
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
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const retrieveSiteNotifications = async (siteId, isParent) => {
    try {
        let query = db.collection('siteNotifications');
        if(!isParent) query = query.where('siteId', '==', siteId);
        const snapShot = await query.orderBy('notification.time', 'desc')
                                    .get(); 
                            
        if(snapShot.size > 0){
            return snapShot.docs.map(document => {
                let data = document.data();
                return data;
            });
        }
        else {
            return [];
        }
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
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
        console.error(error);
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
        console.error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const addNewBiospecimenUser = async (data) => {
    try {
        await db.collection('biospecimenUsers').add(data);
    } catch (error) {
        console.error(error);
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
        console.error(error);
        return new Error(error);
    }
}

const storeSpecimen = async (data) => {
    await db.collection('biospecimen').add(data);
}

const updateSpecimen = async (id, data) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', id).get();
    const docId = snapshot.docs[0].id;
    await db.collection('biospecimen').doc(docId).update(data);
}

const addBox = async (data) => {
    await db.collection('boxes').add(data);
}

const removeBag = async (siteCode, requestData) => {
    let boxId = requestData.boxId;
    let bags = requestData.bags;
    // let currDate = requestData.date;    
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('789843387', '==',siteCode).get();
    if(snapshot.size === 1){
        let doc = snapshot.docs[0];
        let box = doc.data()
        let bagConceptIDs=["147157381", "147157382", "147157383", "147157384", "147157385", "147157386", "147157387", "147157388", "147157389", "147157390", "147157391", "147157392", "147157393", "147157394", "147157395"]
        for (let conceptID in bagConceptIDs) { 
            const currBag = box[conceptID];
            if (!currBag) continue;
            for (let bagID of bags) {               
                if (currBag['309516145'] === bagID || currBag['787237543'] === bagID || currBag['223999569'] === bagID) {
                    delete box[conceptID];                   
                }
            }
        }
        await db.collection('boxes').doc(doc.id).set(box);
        // await db.collection('boxes').doc(docId).update({'lastUpdatedTime':currDate})
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
    if(snapshot.size === 1) return true;
    else return false;
}

const boxExists = async (boxId, loginSite) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('789843387', '==', loginSite).get();
    if(snapshot.size === 1) return true;
    else return false;
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
        let currDate = new Date().toISOString();
        shippingData['656548982'] = currDate;
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
    const snapshot = await db.collection('boxes').where('789843387', '==', institute).get();
    if(snapshot.size !== 0){
        return snapshot.docs.map(document => document.data());
    }
    else{
        return [];
    }
}

const searchBoxesByLocation = async (institute, location) => {
    const snapshot = await db.collection('boxes').where('789843387', '==', institute).where('560975149','==',location).get();
    if(snapshot.size !== 0){
        let result = snapshot.docs.map(document => document.data());
        // console.log(JSON.stringify(result));
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

const getNotificationSpecifications = async (notificationType, notificationCategory, scheduleAt) => {
    try {
        let snapshot = db.collection('notificationSpecifications').where("notificationType", "array-contains", notificationType);
        if(notificationCategory) snapshot = snapshot.where('category', '==', notificationCategory);
        snapshot = snapshot.where('scheduleAt', '==', scheduleAt);
        snapshot = await snapshot.get();
        return snapshot.docs.map(document => {
            return document.data();
        });
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const retrieveParticipantsByStatus = async (conditions, limit, offset) => {
    try {
        let query = db.collection('participants')
                                .limit(limit)
                                .offset(offset);

        for(let obj in conditions) {
            let operator = '';
            let values = ''
            if(conditions[obj]['equals']) {
                values = parseInt(conditions[obj]['equals']);
                operator = '==';
            }
            if(conditions[obj]['notequals']) {
                values = parseInt(conditions[obj]['notequals']);
                operator = '!=';
            }
            query = query.where(obj, operator, values);
        }
        const participants = await query.get();
        return participants.docs.map(document => {
            let data = document.data();
            return data;
        });
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const notificationAlreadySent = async (token, notificationSpecificationsID) => {
    try {
        const snapshot = await db.collection('notifications').where('token', '==', token).where('notificationSpecificationsID', '==', notificationSpecificationsID).get()
        if(snapshot.size === 0) return false
        else true;
    } catch (error) {
        new Error(error)
    }
}

const sendClientEmail = async (data) => {

    const { sendEmail } = require('./notifications');
    const uuid  = require('uuid');

    const reminder = {
        id: uuid(),
        notificationType: data.notificationType,
        email: data.email,
        notification : {
            title: data.subject,
            body: data.message,
            time: data.time
        },
        attempt: data.attempt,            
        category: data.category,
        token: data.token,
        uid: data.uid,
        read: data.read
    }

    await storeNotifications(reminder);

    sendEmail(data.email, data.subject, data.message);
    return true;
};

const storeNotifications = async payload => {
    try {
        await db.collection('notifications').add(payload);
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const markNotificationAsRead = async (id, collection) => {
    const snapshot = await db.collection(collection).where('id', '==', id).get();
    const docId = snapshot.docs[0].id;
    await db.collection(collection).doc(docId).update({read: true});
}

const storeSSN = async (data) => {
    await db.collection('ssn').add(data);
}

const getTokenForParticipant = async (uid) => {
    const snapshot = await db.collection('participants').where('state.uid', '==', uid).get();
    return snapshot.docs[0].data()['token'];
}

const getSiteDetailsWithSignInProvider = async (acronym) => {
    const snapshot = await db.collection('siteDetails').where('acronym', '==', acronym).get();
    return snapshot.docs[0].data();
}

const retrieveNotificationSchemaByID = async (id) => {
    const snapshot = await db.collection('notificationSpecifications').where('id', '==', id).get();
    if(snapshot.size === 1) {
        return snapshot.docs[0].id;
    }
    else return new Error('Invalid notification Id!!')
}

const retrieveNotificationSchemaByCategory = async (category) => {
    let query = db.collection('notificationSpecifications')
    if(category !== 'all') query = query.where('category', '==', category)
    else query = query.orderBy('category')
    const snapshot = await query.orderBy('attempt').get();
    if(snapshot.size === 0) return false;
    return snapshot.docs.map(dt => dt.data());
}

const storeNewNotificationSchema = async (data) => {
    await db.collection('notificationSpecifications').add(data);
    return true;
}

const updateNotificationSchema = async (docID, data) => {
    await db.collection('notificationSpecifications').doc(docID).update(data);
    return true;
}

const getNotificationHistoryByParticipant = async (token, siteCode, isParent) => {
    const operator = isParent ? 'in' : '==';
    const participantRecord = await db.collection('participants')
                                        .where('token', '==', token)
                                        .where('827220437', operator, siteCode)
                                        .get();
    if(participantRecord.size === 1) {
        const snapshot = await db.collection('notifications')
                                    .where('token', '==', token)
                                    .orderBy('notification.time', 'desc')
                                    .get();
        return snapshot.docs.map(dt => dt.data());
    }
    else return false;
}

const getNotificationsCategories = async (scheduleAt) => {
    const snapshot = await db.collection('notificationSpecifications').where('scheduleAt', '==', scheduleAt).get();
    const categories = [];
    snapshot.forEach(dt => {
        const category = dt.data().category;
        if(!categories.includes(category)) categories.push(category);
    })
    return categories;
}

const addKitAssemblyData = async (data) => {
    try {
        data['supplyKitIdUtilized'] = false
        await db.collection('kitAssembly').add(data);
        return true;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const getKitAssemblyData = async () => {
    try {
        const snapshot = await db.collection("kitAssembly").get();
        if(snapshot.size !== 0)  return snapshot.docs.map(doc => doc.data()) 
        else return false;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const storeSiteNotifications = async (reminder) => {
    try {
        await db.collection('siteNotifications').add(reminder);
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getCoordinatingCenterEmail = async () => {
    try {
        const snapshot = await db.collection('siteDetails').where('coordinatingCenter', '==', true).get();
        if(snapshot.size > 0) return snapshot.docs[0].data().email;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getSiteEmail = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        if(snapshot.size > 0) return snapshot.docs[0].data().email;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const addPrintAddressesParticipants = async (data) => {
    try {
        const uuid = require('uuid');
        const currentDate = new Date().toISOString();
        const batch = db.batch();
        await data.map(async (i) => {
           let assignedUUID = uuid();
           i.id = assignedUUID;
           i.time_stamp = currentDate;
           const docRef = await db.collection('participantSelection').doc(assignedUUID);
           batch.set(docRef, i);
           await kitStatusCounterVariation('addressPrinted', 'pending');
         });
        await batch.commit();
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const getParticipantSelection = async (filter) => {
    try {
        if (filter === 'all') {
            const snapshot = await db.collection("participantSelection").get();
            return snapshot.docs.map(doc => doc.data())
        }
        else {
            const snapshot = await db.collection("participantSelection")
                                    .where('kit_status', '==', filter)
                                    .get();
            return snapshot.docs.map(doc => doc.data())
        }
    }
    catch(error){
        return new Error(error);
    }
}

const assignKitToParticipants = async (data) => {
    try {
        const snapshot = await db.collection("kitAssembly").where('supplyKitId', '==', data.supply_kitId).where('supplyKitIdUtilized', '==', false).get();
        if (Object.keys(snapshot.docs).length !== 0) {
            snapshot.docs.map(doc => {
                data['collection_cardId'] = doc.data().collectionCardId
                data['collection_cupId'] = doc.data().collectionCupId
                data['specimen_kitId'] = doc.data().specimenKitId
                data['specimen_kit_usps_trackingNum'] = doc.data().uspsTrackingNumber
            })
            const docId = snapshot.docs[0].id;
            await db.collection("kitAssembly").doc(docId).update(
            { 
                supplyKitIdUtilized: true
            })
            await db.collection("participantSelection").doc(data.id).update(
            { 
                kit_status: "assigned",
                usps_trackingNum: data.usps_trackingNum,
                supply_kitId: data.supply_kitId,
                collection_cardId: data.collection_cardId,
                collection_cupId: data.collection_cupId,
                specimen_kitId: data.specimen_kitId,
                specimen_kit_usps_trackingNum: data.specimen_kit_usps_trackingNum
            })
            await kitStatusCounterVariation('assigned', 'addressPrinted');
            return true;
        } else {
            return false;
        } }
    catch(error){
        return new Error(error);
    }
}

const shipKits = async (data) => {
    try {
        await db.collection("participantSelection").doc(data.id).update(
            { 
                kit_status: "shipped",
                pickup_date: data.pickup_date,
                confirm_pickup: data.confirm_pickup
            })
            await kitStatusCounterVariation('shipped', 'assigned');
        return true;
        }
    catch(error){
        return new Error(error);
    }
}

const storePackageReceipt =  (data) => {
    if (data.scannedBarcode.length === 12 || data.scannedBarcode.length === 34) {  
        const response = setPackageReceiptFedex(data);
        return response;
    } else { 
        const response = setPackageReceiptUSPS(data);
        return response; 
    }

} 

const setPackageReceiptUSPS = async (data) => {
    try {
        const snapshot = await db.collection("participantSelection").where('usps_trackingNum', '==', data.scannedBarcode).get();
        const docId = snapshot.docs[0].id;
        await db.collection("participantSelection").doc(docId).update(
        { 
            baseline: data
        })
            return true;
        }
    catch(error){
        return new Error(error);
    }
}

const setPackageReceiptFedex = async (data) => {
    try {
        const snapshot = await db.collection("boxes").where('959708259', '==', data.scannedBarcode).get(); // find related box using barcode
        if (snapshot.empty) {
            return false
        }
        const docId = snapshot.docs[0].id;
        await db.collection("boxes").doc(docId).update(data)
        if (Object.keys(snapshot.docs.length) !== 0) {
            snapshot.docs.map(doc => { 
                let collectionIdKeys = Object.keys(doc.data().bags); // grab all the collection ids
                collectionIdKeys.forEach (async (i) => {
                    let storeCollectionId = i.split(' ')[0] 
                    const secondSnapshot = await db.collection("biospecimen").where('820476880', '==', storeCollectionId).get(); // find related biospecimen using collection id
                    const docId = secondSnapshot.docs[0].id; // grab the docID to update the biospecimen
                    let getBiospecimenDataObject = await db.collection("biospecimen").doc(docId).get();
                    let biospecimenDataObj =  getBiospecimenDataObject.data()
                  

                    for ( const element of doc.data().bags[i].arrElements) {
                        let tubeId = element.split(' ')[1];
                        let conceptTube = collectionIdConversion[tubeId]; // grab tube ids & map them to appropriate concept ids
                        biospecimenDataObj["259439191"] = new Date().toISOString();
                        biospecimenDataObj[conceptTube]["259439191"] = new Date().toISOString();

                        await db.collection("biospecimen").doc(docId).update( biospecimenDataObj ) // using the docids update the biospecimen with the received date
                        }
                })
            })
        }
        return true;
         }
    catch(error){
        return new Error(error);
    }
}

const kitStatusCounterVariation = async (currentkitStatus, prevKitStatus) => {
    try {
        await db.collection("bptlMetrics").doc('--metrics--').update({ 
            [currentkitStatus]: increment
        })
        await db.collection("bptlMetrics").doc('--metrics--').update({ 
            [prevKitStatus]: decrement
        })
            return true;
    }

    catch (error) {
        return new Error(error);
    }
};

const getBptlMetrics = async () => {
    const snapshot = await db.collection("bptlMetrics").get();
    return snapshot.docs.map(doc => doc.data())
}

const getBptlMetricsForShipped = async () => {
    try {
        let response = []
        const snapshot = await db.collection("participantSelection").where('kit_status', '==', 'shipped').get();
        let shipedParticipants = snapshot.docs.map(doc =>  doc.data())
        const keys = ['first_name', 'last_name', 'pickup_date', 'participation_status']
        shipedParticipants.forEach( i => { response.push(pick(i, keys) )});
        return response;
        }

    catch(error){
        return new Error(error);
    }
}

const pick = (obj, arr) => {
    return arr.reduce((acc, record) => (record in obj && (acc[record] = obj[record]), acc), {})
} 

const getQueryBsiData = async (query) => {
    try {
        let storeResults = []
        let holdBiospecimenMatches = []
        const snapshot = await db.collection("biospecimen").where('259439191', '>=', query).get();
        let tubeConceptIds = Object.values(collectionIdConversion);
        snapshot.docs.map(doc => {
            holdBiospecimenMatches.push(doc.data())
        })

        holdBiospecimenMatches.forEach( i => {
            tubeConceptIds.forEach( id => {
                if (id in i) {
                    let collectionIdInfo = {}
                    collectionIdInfo['825582494'] = i[id]['825582494']
                    collectionIdInfo['259439191'] = i['259439191']
                    collectionIdInfo['678166505'] = i['678166505']
                    collectionIdInfo['Connect_ID'] = i['Connect_ID']
                    collectionIdInfo['siteAcronym'] = i['siteAcronym']
                    storeResults.push(collectionIdInfo)
                }

            })

        })
        return storeResults
    }
    catch(error){
        return new Error(error);
    }
}
const getRestrictedFields = async () => {
    const snapshot = await db.collection('siteDetails').where('coordinatingCenter', '==', true).get();
    return snapshot.docs[0].data().restrictedFields;
}

module.exports = {
    updateResponse,
    validateSiteUser,
    retrieveParticipants,
    verifyIdentity,
    retrieveUserProfile,
    createRecord,
    recordExists,
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
    filterDB,
    validateBiospecimenUser,
    biospecimenUserList,
    biospecimenUserExists,
    addNewBiospecimenUser,
    removeUser,
    storeSpecimen,
    updateSpecimen,
    searchSpecimen,
    searchShipments,
    specimenExists,
    boxExists,
    addBox,
    updateBox,
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
    incrementCounter,
    decrementCounter,
    updateParticipantRecord,
    retrieveParticipantsEligibleForIncentives,
    getNotificationSpecifications,
    retrieveParticipantsByStatus,
    notificationAlreadySent,
    storeNotifications,
    validateSiteSAEmail,
    validateMultiTenantIDToken,
    markNotificationAsRead,
    storeSSN,
    getTokenForParticipant,
    getSiteDetailsWithSignInProvider,
    retrieveNotificationSchemaByID,
    retrieveNotificationSchemaByCategory,
    storeNewNotificationSchema,
    updateNotificationSchema,
    getNotificationHistoryByParticipant,
    getNotificationsCategories,
    addKitAssemblyData,
    getKitAssemblyData,
    storeSiteNotifications,
    getCoordinatingCenterEmail,
    getSiteEmail,
    retrieveSiteNotifications,
    addPrintAddressesParticipants,
    getParticipantSelection,
    assignKitToParticipants,
    shipKits,
    storePackageReceipt,
    getBptlMetrics,
    getBptlMetricsForShipped,
    getQueryBsiData,
    getRestrictedFields,
    sendClientEmail
}