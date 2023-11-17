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
const { tubeKeyToNum, tubeConceptIds, collectionIdConversion, swapObjKeysAndValues, batchLimit, listOfCollectionsRelatedToDataDestruction, createChunkArray } = require('./shared');
const fieldMapping = require('./fieldToConceptIdMapping');
const { isIsoDate } = require('./validation');

const nciCode = 13;
const nciConceptId = `517700004`;
const tubesBagsCids = fieldMapping.tubesBagsCids;

const verifyTokenOrPin = async ({ token = null, pin = null }) => {
  const resultObj = { isDuplicateAccount: false, isValid: false, docId: null };
  if (!token && !pin) return resultObj;

  let query = db.collection('participants');
  if (token) {
    query = query.where('token', '==', token);
  } else {
    query = query.where('pin', '==', pin);
  }

  const snapshot = await query.get();
  if (snapshot.size === 1) {
    const participantData = snapshot.docs[0].data();
    if (
      participantData[fieldMapping.verificationStatus] ===
      fieldMapping.duplicate
    ) {
      resultObj.isDuplicateAccount = true;
      return resultObj;
    }

    if (participantData.state.uid === undefined) {
      resultObj.isValid = true;
      resultObj.docId = snapshot.docs[0].id;
    }
  }

  return resultObj;
};

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
            if(from || to) query = query.orderBy("914594314", "desc")
            query = query.orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent   
            if(from) query = query.where('914594314', '>=', from)
            if(to) query = query.where('914594314', '<=', to)
            participants = await query.get();
        }
        if(decider === 'active') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("914594314", "desc")
            query = query.where("512820379", "==", 486306141) // Recruit type active
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('914594314', '>=', from)
            if(to) query = query.where('914594314', '<=', to)
            participants = await query.get();
        }
        if(decider === 'notactive') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("914594314", "desc")
            query = query.where("512820379", "==", 180583933) // Recruit type not active
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('914594314', '>=', from)
            if(to) query = query.where('914594314', '<=', to)
            participants = await query.get();
        }
        if(decider === 'passive') {
            let query = db.collection('participants')
            if(from || to) query = query.orderBy("914594314", "desc")
            query = query.where("512820379", "==", 854703046) // Recruit type passive
                            .orderBy("821247024", "asc")
                            .offset(offset)
                            .limit(limit)
            
            if(site) query = query.where('827220437', '==', site) // Get for a specific site
            else query = query.where('827220437', operator, siteCode) // Get for all site if parent
            if(from) query = query.where('914594314', '>=', from)
            if(to) query = query.where('914594314', '<=', to)
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

const retrieveRefusalWithdrawalParticipants = async (siteCode, isParent, concept, limit, page) => {
    try {
        const operator = isParent ? 'in' : '==';
        const offset = (page - 1) * limit;
        
        let participants = await db.collection('participants')
                                .where('827220437', operator, siteCode)
                                .where(concept, '==', 353358909)
                                .orderBy('Connect_ID', 'asc')
                                .offset(offset)
                                .limit(limit)
                                .get();                 

        return participants.docs.map(document => {
            return document.data();
        });
    } catch (error) {
        console.error(error);
        return new Error(error)
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
            return {firstName: data['399159511'], email: data['869588347'], token: data['token'], site: data['827220437']}
        });
    } catch (error) {
        console.error(error);
        return new Error(error)
    }
}

const removeDocumentFromCollection = async (connectID, token) => {
    try {
        for (const collection of listOfCollectionsRelatedToDataDestruction) {
            const query = db.collection(collection)
            const data =
                collection === "notifications"
                    ? await query.where("token", "==", token).get()
                    : await query.where("Connect_ID", "==", connectID).get();
            
            if (data.size !== 0) {
                for (const dt of data.docs) {
                    await db.collection(collection).doc(dt.id).delete();
                }
            }
        }
    } catch (error) {
        console.error(`Error occurred when remove documents related to participan: ${error}`);
    }
};

/**
 * This function is run every day at 01:00.
 * This function is used to delete the data of the participant who requested and signed the data destruction form or requested data destruction within 60 days
 */
const removeParticipantsDataDestruction = async () => {
    try {
        let count = 0;
        const millisecondsWait = 5184000000; // 60days
        // Stub records that will be retained after deleting data.
        const stubFieldArray = [ "query", "pin", "token", "state", "Connect_ID", "471168198", "736251808", "436680969", "480305327", "564964481", "795827569", "544150384", "371067537", "454205108", "454445267", "919254129", "412000022", "558435199", "262613359", "821247024", "914594314", "747006172", "659990606", "299274441", "919699172", "141450621", "576083042", "431428747", "121430614", "523768810", "639172801", "175732191", "150818546", "624030581", "285488731", "596510649", "866089092", "990579614", "131458944", "372303208", "777719027", "620696506", "352891568", "958588520", "875010152", "404289911", "637147033", "734828170", "715390138", "538619788", "153713899", "613641698", "407743866", "831041022", "269050420", "359404406", "119449326", "304438543", "912301837", "130371375", "765336427", "479278368", "826240317", "693626233", "104278817", "744604255", "268665918", "592227431", "399159511", "231676651", "996038075", "506826178", "524352591", "902332801", "457532784", "773707518", "577794331", "883668444", "827220437", "699625233", ];
        // Sub stub records of "query" and "state".
        const subStubFieldArray = ["firstName", "lastName", "studyId", "uid"];
        // CID for participant's data destruction status.
        const dataHasBeenDestroyed =
            fieldMapping.participantMap.dataHasBeenDestroyed.toString();
        const destroyDataCId =
            fieldMapping.participantMap.destroyData.toString();
        const dateRequestedDataDestroyCId =
            fieldMapping.participantMap.dateRequestedDataDestroy.toString();
        const destroyDataCategoricalCId =
            fieldMapping.participantMap.destroyDataCategorical.toString();
        const requestedAndSignCId =
            fieldMapping.participantMap.requestedAndSign;

        // Get all participants who have requested data destruction and have not been processed.
        const currSnapshot = await db
            .collection("participants")
            .where(destroyDataCId, "==", fieldMapping.yes)
            .where(dataHasBeenDestroyed, "!=", fieldMapping.yes)
            .get();

        // Check each participant if they are already registered or more than 60 days from the date of their request
        // then the system will delete their data except the stub records and update the dataHasBeenDestroyed flag to yes.
        for (const doc of currSnapshot.docs) {
            const batch = db.batch();
            const participant = doc.data();
            const timeDiff = isIsoDate(participant[dateRequestedDataDestroyCId])
                ? new Date().getTime() -
                  new Date(participant[dateRequestedDataDestroyCId]).getTime()
                : 0;

            if (
                participant[destroyDataCategoricalCId] ===
                    requestedAndSignCId ||
                timeDiff > millisecondsWait
            ) {
                let hasRemovedField = false;
                const fieldKeys = Object.keys(participant);
                const participantRef = doc.ref;
                fieldKeys.forEach((key) => {
                    if (!stubFieldArray.includes(key)) {
                        batch.update(participantRef, {
                            [key]: admin.firestore.FieldValue.delete(),
                        });
                        hasRemovedField = true;
                    } else {
                        if (key === "query" || key === "state") {
                            const subFieldKeys = Object.keys(participant[key]);
                            subFieldKeys.forEach((subKey) => {
                                if (!subStubFieldArray.includes(subKey)) {
                                    batch.update(participantRef, {
                                        [`${key}.${subKey}`]:
                                            admin.firestore.FieldValue.delete(),
                                    });
                                }
                            });
                        }
                    }
                });
                if (hasRemovedField) {
                    batch.update(participantRef, {
                        [dataHasBeenDestroyed]: fieldMapping.yes,
                    });
                    count++;
                }
            }
            await batch.commit();
            await removeDocumentFromCollection(
                participant["Connect_ID"],
                participant["token"]
            );
        }

        console.log(
            `Successfully updated ${count} participants for data destruction`
        );
    } catch (error) {
        console.error(`Error occurred when updating documents: ${error}`);
    }
};

const removeUninvitedParticipants = async () => {
    try {
        let count = 0;
        let willContinue = true;
        const uninvitedRecruitsCId = fieldMapping.participantMap.uninvitedRecruits.toString();

        while (willContinue) {
            const currSnapshot = await db
            .collection('participants')
            .where(uninvitedRecruitsCId, '==', fieldMapping.yes)
            .limit(batchLimit)
            .get();

            willContinue = currSnapshot.docs.length === batchLimit;
            const batch = db.batch();
            for (const doc of currSnapshot.docs) {
                batch.delete(doc.ref);
                count++
            }
        
            await batch.commit();
        }

        console.log(`Successfully deleted ${count} uninvited participants`)
    } catch (error) {
        willContinue = false;
        console.error(`Error occurred when deleting documents: ${error}`);
    }
}

/**
 * Get site codes of children entities
 * @param {string} id - Entity ID
 */
const getChildren = async (id) => {
    try{
        const snapShot = await db.collection('siteDetails')
                                .where('state.parentID', 'array-contains', id)
                                .get();
        if(snapShot.size > 0) {
            /** @type {number[]} */
            const siteCodes = [];
            snapShot.docs.forEach(document => {
                if(document.data().siteCode){
                    siteCodes.push(document.data().siteCode);
                }
            });
            return siteCodes;
        }
        return [];
    }
    catch(error){
        console.error(error);
        return [];
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

        if(snapShot.size > 0) {
            let data = snapShot.docs[0].data();
            delete data.state;

            return data;
        }
        else {
            return {};
        }
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const retrieveConnectID = async (uid) => {
    try{
        const snapshot = await db.collection('participants')
                                .where('state.uid', '==', uid)
                                .get();
        if(snapshot.size === 1){
            if(snapshot.docs[0].data()['Connect_ID']) {
                return snapshot.docs[0].data()['Connect_ID'];
            }
            else {
                return new Error('Connect ID not found on record!');
            }
        }
        else{
            return new Error('Error retrieving single Connect ID!');    
        }
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const retrieveUserSurveys = async (uid, concepts) => {
    try {
        let surveyData = {};

        const { moduleConceptsToCollections } = require('./shared');
 
        for await (const concept of concepts) {
            
            if (moduleConceptsToCollections[concept]) {
                const snapshot = await db.collection(moduleConceptsToCollections[concept]).where('uid', '==', uid).get();
            
                if(snapshot.size > 0){
                    surveyData[concept] = snapshot.docs[0].data();
                }
            }
        };

        return surveyData;
    }
    catch(error) {
        console.error(error);
        return new Error(error);
    }
}

const surveyExists = async (collection, uid) => {
    const snapshot = await db.collection(collection).where('uid', '==', uid).get();
    if (snapshot.size > 0) {
        return snapshot.docs[0];
    }
    else {
        return false;
    }
}

const storeSurvey = async (data, collection) => {
    try {
        await db.collection(collection).add(data);
        return true;
    }
    catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const updateSurvey = async (data, collection, doc) => {
    try {
        await db.collection(collection).doc(doc.id).update(data);
        return true;
    }
    catch (error) {
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

/**
 * Retrieve a list of participants from the database.
 * If name is in the query, we handle the typeof(participantDoc.query.firstName) === 'array' case with firestore's 'array-contains' operator.
 * Only one 'array-contains' operation can be done per query, so separate queries are required if both firstName and lastName are in the query.
 * We also use array-contains for email and phone number. Note: only email or phone can be included in a query, not both.
 */
const filterDB = async (queries, siteCode, isParent) => {

    // Make separate get requests for each query, since Firestore only allows one 'array-contains' query per request.
    // This isolates a single array-contains query (firstName, lastName, email, phone).
    const updateQueryForArrayContainsConstraints = (queryInput) => {
        const newQueriesObj = {...queries};

        for(let property in newQueriesObj) {
            if(queryInput.includes(newQueriesObj[property])) {
                delete newQueriesObj[property];
            }
        }

        return newQueriesObj;
    };

    // Direct the generation and execution of queries based on the search properties present. If neither firstName nor lastName are present, this function is bypassed.
    const handleNameQueries = async (firstNameQuery, lastNameQuery, phoneEmailQuery) => {
        const searchPromises = [];

        if (firstNameQuery) {
            const fNameArrayQueryForSearch = generateQuery(firstNameQuery);
            searchPromises.push(executeQuery(fNameArrayQueryForSearch));
        }

        if (lastNameQuery) {
            const lNameArrayQueryForSearch = generateQuery(lastNameQuery);
            searchPromises.push(executeQuery(lNameArrayQueryForSearch));
        }

        if (phoneEmailQuery) {
            const phoneOrEmailQueryForSearch = generateQuery(phoneEmailQuery);
            searchPromises.push(executeQuery(phoneOrEmailQueryForSearch));
        }

        await Promise.all(searchPromises);
    };

    // Generate the queries.
    const generateQuery = (queryKeys) => {
        let participantQuery = collection;

        for (let key in queryKeys) {
            if (key === 'firstName' || key === 'lastName') {
                const path = `query.${key}`;
                const queryValue = key === 'firstName' ? queries.firstName : queries.lastName;
                participantQuery = participantQuery.where(path, 'array-contains', queryValue);
            }
            if (key === 'email' || key === 'phone') {
                const path = `query.${key === 'email' ? 'allEmails' : 'allPhoneNo'}`;
                const queryValue = key === 'email' ? queries.email : queries.phone;
                participantQuery = participantQuery.where(path, 'array-contains', queryValue);
            }
            if (key === 'dob') participantQuery = participantQuery.where('371067537', '==', queries.dob);
            if (key === 'connectId') participantQuery = participantQuery.where('Connect_ID', '==', parseInt(queries.connectId));
            if (key === 'token') participantQuery = participantQuery.where('token', '==', queries.token);
            if (key === 'studyId') participantQuery = participantQuery.where('state.studyId', '==', queries.studyId);
            if (key === 'checkedIn') participantQuery = participantQuery.where('331584571.266600170.135591601', '==', 353358909);
            if (key === 'birthMonth') participantQuery = participantQuery.where(`${fieldMapping.birthMonth}`, '==', queries.birthMonth);
        }

        return participantQuery;
    }   

    // This executes each query and pushes the data to the fetchedResults array.
    const executeQuery = async (query) => {
        const operator = isParent ? 'in' : '==';
        const snapshot = await (queries['allSiteSearch'] === 'true' ? query.get() : query.where('827220437', operator, siteCode).get());
        if (snapshot.size !== 0) {
            snapshot.docs.forEach(doc => {
                fetchedResults.push(doc.data());
            });
        }
    };

    // Remove duplicate Connect_ID entries from fetchedResults. Since we have to perform multiple get() requests to handle the array-contains queries, we get some duplicate entries in fetchedResults.
    // Example: search for 'John Smith' will result in two get() requests: one for 'John' and one for 'Smith'. Both requests return the same participant. Remove the duplicate.
    const removeDuplicateResults = () => {
        let uniqueParticipants = new Set();

        fetchedResults = fetchedResults.filter(participant => {
            if (uniqueParticipants.has(participant.Connect_ID)) {
                return false;
            } else {
                uniqueParticipants.add(participant.Connect_ID);
                return true;
            }
        });
    };

    // Remove results that don't match the query. Ex: if the query is for 'John Smith', the results include 'John Doe', 'John Smith', and 'Jane Smith'. Remove 'John Doe' and 'Jane Smith' from the results.
    // Why? We run multiple queries due to the array-contains constraints, end up with results that don't match the query when more than one array-contains operation is executed.
    const removeMismatchedResults = () => {
        fetchedResults = fetchedResults.filter(participant => {
            return (!queries.firstName || participant.query.firstName.includes(queries.firstName)) &&
                (!queries.lastName || participant.query.lastName.includes(queries.lastName)) &&
                (!queries.email || participant.query.allEmails.includes(queries.email)) &&
                (!queries.phone || participant.query.allPhoneNo.includes(queries.phone))
        });
    };

    // Control flow for the participant query
    // If two or more of firstName, lastName, and (email or phone) are included in the query, run multiple queries.
    // If only firstName or lastName is in the query (no phone or email), handle the array case for participantDoc.query.firstName or participantDoc.query.lastName
    // If compound queries are executed, handle results including duplicates and the mismatches caused by executing multiple queries.
    // If neither firstName nor lastName are in the query, run a simple query that doesn't need post-processing. This is the else statement, return early.
    const collection = db.collection('participants');
    let fetchedResults = [];

    if (queries.firstName) queries.firstName = queries.firstName.toLowerCase();
    if (queries.lastName) queries.lastName = queries.lastName.toLowerCase();
    if (queries.email) queries.email = queries.email.toLowerCase();
        
    try {
        if (queries.firstName && queries.lastName && (queries.email || queries.phone)) {
            const fNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.lastName, queries.phone, queries.email]);
            const lNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.phone, queries.email]);
            const phoneOrEmailExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.lastName]);
            await handleNameQueries(fNameExtractedQuery, lNameExtractedQuery, phoneOrEmailExtractedQuery);
        } else if (queries.firstName && queries.lastName) {
            const fNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.lastName, queries.phone, queries.email]);
            const lNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.phone, queries.email]);
            await handleNameQueries(fNameExtractedQuery, lNameExtractedQuery, null);
        } else if (queries.firstName && (queries.email || queries.phone)) {
            const fNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.lastName, queries.phone, queries.email]);
            const phoneOrEmailExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.lastName]);
            await handleNameQueries(fNameExtractedQuery, null, phoneOrEmailExtractedQuery);
        } else if (queries.lastName && (queries.email || queries.phone)) {
            const lNameExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.phone, queries.email]);
            const phoneOrEmailExtractedQuery = updateQueryForArrayContainsConstraints([queries.firstName, queries.lastName]);
            await handleNameQueries(null, lNameExtractedQuery, phoneOrEmailExtractedQuery);
        } else if (queries.firstName) {
            await handleNameQueries(queries, null, null);
        } else if (queries.lastName) {
            await handleNameQueries(null, queries, null);
        } else {
            const nonNameQuery = generateQuery(queries);
            await executeQuery(nonNameQuery);

            return fetchedResults;
        }
  
        removeDuplicateResults();
        removeMismatchedResults();

        return fetchedResults;

    } catch (error) {
      console.error(error);
      return new Error(error);
    }
};

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

// atomically create a new box in the 'boxes' collection and update the 'siteDetails' doc with the most recent boxId as a numeric value
const addBoxAndUpdateSiteDetails = async (data) => {
    try {
        const boxDocRef = db.collection('boxes').doc();
        const siteDetailsDocRef = db.collection('siteDetails').doc(data['siteDetailsDocRef']);
        delete data['siteDetailsDocRef'];

        if (!siteDetailsDocRef) {
            throw new Error("siteDetailsDocRef is not provided in the data object.");
        }

        const boxIdString = data[fieldMapping.shippingBoxId];
        if (!boxIdString || typeof boxIdString !== 'string') {
            throw new Error("Invalid or missing BoxId value in the data object.");
        }

        const numericBoxId = parseInt(boxIdString.substring(3));
        if (isNaN(numericBoxId)) {
            throw new Error("Failed to parse numericBoxId from BoxId value.");
        }

        const batch = db.batch();
        batch.set(boxDocRef, data);
        batch.update(siteDetailsDocRef, { 'mostRecentBoxId': numericBoxId });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error in addBoxAndUpdateSiteDetails:", error.message);
        throw new Error('Error in addBoxAndUpdateSiteDetails', { cause: error });
    }
}

const getUnshippedBoxes = async (siteCode, isBPTL = false) => {
    try {
        let query = db.collection('boxes').where(fieldMapping.submitShipmentFlag.toString(), '==', fieldMapping.no);
        if (!isBPTL) query = query.where(fieldMapping.loginSite.toString(), '==', siteCode);
        const snapshot = await query.get();
        
        return snapshot.docs.map(document => document.data());
    } catch (error) {
        console.error(error);
        throw new Error(error, { cause: error });
    }
}

/**
 * Fetch specimen docs based on boxed status of notBoxed, partiallyBoxed, or boxed.
 * @param {number} siteCode - Site code of the specimens to fetch.
 * @param {number} boxedStatusConceptId - Concept ID of the boxedStatus. 
 * @param {boolean} isBPTL - Is this a BPTL call? If yes, don't apply the healthCareProvider filter or the stray tube aging filter.
 * @returns {array} - Array of specimen docs.
 */
const getSpecimensByBoxedStatus = async (siteCode, boxedStatusConceptId, isBPTL = false) => {
    try {
        let query = db.collection('biospecimen').where(fieldMapping.boxedStatus.toString(), '==', boxedStatusConceptId);
        if (!isBPTL) query = query.where(fieldMapping.healthCareProvider.toString(), '==', siteCode);

        const snapshot = await query.get();
        
        return snapshot.docs.map(document => document.data());
    } catch (error) {
        console.error(error);
        throw new Error(error, { cause: error });
    }
}

/**
 * Add a bag to the box. Orphan tubes are treated as separate bags.
 * Also manage/update/maintain the specimen doc's boxedStatus and strayTubeArray fields.
 * @param {string} id - id of the box to update.
 * @param {object} boxAndTubesData - data package to update the box and specimen doc.
 * @param {array<string>} addedTubes - array of collectionIds of the tubes to add to the box. Format: `${collectionId} ${tubeType}`
 * @param {string} loginSite - the user's site code.
 */
const updateBox = async (id, boxAndTubesData, addedTubes, loginSite) => {
    try {
        const { manageSpecimenBoxedStatusAddBag } = require('./shared');
        const addedTubesCollectionId = addedTubes[0].split(' ')[0];

        const snapshotResponse = await Promise.all([
            db.collection('boxes')
                .where(fieldMapping.shippingBoxId.toString(), '==', id)
                .where(fieldMapping.loginSite.toString(), '==', loginSite)
                .get(),
            db.collection('biospecimen')
                .where(fieldMapping.collectionId.toString(), '==', addedTubesCollectionId)
                .where(fieldMapping.healthCareProvider.toString(), '==', loginSite)
                .get()
        ]);

        const boxSnapshot = snapshotResponse[0].docs.map(doc => ({ ref: doc.ref, data: doc.data() }));
        const specimenSnapshot = snapshotResponse[1].docs.map(doc => ({ ref: doc.ref, data: doc.data() }));
        
        if (boxSnapshot.length !== 1 || specimenSnapshot.length !== 1) {
            throw new Error('Couldn\'t find Matching documents.');
        }

        const updatedSpecimenData = manageSpecimenBoxedStatusAddBag(specimenSnapshot[0], addedTubes);
        const boxDocRef = boxSnapshot[0].ref;
        const specimenDocRef = updatedSpecimenData.ref;
        delete updatedSpecimenData.ref;

        const specimenDataToWrite = {
            [fieldMapping.boxedStatus]: updatedSpecimenData[fieldMapping.boxedStatus],
            [fieldMapping.strayTubesList]: updatedSpecimenData[fieldMapping.strayTubesList],
        }
        
        delete boxAndTubesData['addedTubes'];
        
        const batch = db.batch();
        batch.update(boxDocRef, boxAndTubesData);
        batch.update(specimenDocRef, specimenDataToWrite);
        await batch.commit();
        return updatedSpecimenData;
    } catch (error) {
        console.error("Error updating box:", error);
        throw new Error(error);
    }
}

/**
 * Remove a bag from a box. Orphan tubes are treated as separate bags.
 * @param {*} siteCode - Site code of the site where the box is located.
 * @param {*} requestData - Single element array for regular bags and one element for stray tube for orphan bags.
 * @returns - Success or Failure message.
 */
const removeBag = async (siteCode, requestData) => {
    const { sortBoxOnBagRemoval, manageSpecimenBoxedStatusRemoveBag } = require('./shared');
    
    const boxId = requestData.boxId;
    const bagsToRemove = requestData.bags;
    const bagCollectionIdArray = bagsToRemove.map(bagId => bagId.split(' ')[0]);
    const currDate = requestData.date;

    const boxQuery = db.collection('boxes')
        .where(fieldMapping.shippingBoxId.toString(), '==', boxId)
        .where(fieldMapping.loginSite.toString(), '==', siteCode)
        .get();

    const chunkedSpecimenQueries = [];
    const chunkSize = 15;

    // Split bagCollectionIdArray into chunks of 15 or fewer elements for use with 'in' operator.
    for (let i = 0; i < bagCollectionIdArray.length; i += chunkSize) {
        const specimenCollectionIdChunk = bagCollectionIdArray.slice(i, i + chunkSize);
        const specimenQuery = db.collection('biospecimen')
            .where(fieldMapping.collectionId.toString(), 'in', specimenCollectionIdChunk)
            .where(fieldMapping.healthCareProvider.toString(), '==', siteCode)
            .get();
        chunkedSpecimenQueries.push(specimenQuery);
    }

    const [boxSnapshot, ...specimenSnapshots] = await Promise.all([boxQuery, ...chunkedSpecimenQueries]);

    if (boxSnapshot.size !== 1 || specimenSnapshots.some(snapshot => snapshot.empty)) {
        throw new Error('Couldn\'t find Matching documents.');
    }

    const boxData = boxSnapshot.docs[0].data();
    const boxDocRef = boxSnapshot.docs[0].ref;

    const specimenDataArray = [];
    for (const snapshot of specimenSnapshots) {
        snapshot.docs.forEach(doc => {
            specimenDataArray.push({ data: doc.data(), ref: doc.ref });
        });
    }

    // Samples within bag = { collectionId: [sampleId1, sampleId2, ...]}
    const { updatedBoxData, samplesWithinBag } = sortBoxOnBagRemoval(boxData, bagsToRemove, currDate);    
    const updatedSpecimenDataArray = manageSpecimenBoxedStatusRemoveBag(specimenDataArray, samplesWithinBag);
    
    try {
        const batch = db.batch();
        // set the new box data
        batch.set(boxDocRef, updatedBoxData);
        // build the specimen update object for each specimen (there will only be > 1 for 'unlabelled' bags)
        for (const updatedSpecimenData of updatedSpecimenDataArray) {
            const specimenDocRef = updatedSpecimenData.ref;
            delete updatedSpecimenData.ref;
            const specimenDataToWrite = {
                [fieldMapping.boxedStatus]: updatedSpecimenData[fieldMapping.boxedStatus],
                [fieldMapping.strayTubesList]: updatedSpecimenData[fieldMapping.strayTubesList]
            };
            batch.update(specimenDocRef, specimenDataToWrite);
        }
        await batch.commit();
        return updatedSpecimenDataArray;
    } catch (error) {
        console.error('Error writing document: ', error);
        throw new Error('Error updating the box in the database.');
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
        "0006": "973670172",
        "0060": "505347689",
    }
    let conceptTube = conversion[tubeId];

    const snapshot = await db.collection('biospecimen').where('820476880', '==', masterSpecimenId).where('siteAcronym', '==', siteAcronym).get();
    if(snapshot.size === 1 && conceptTube != undefined){
        const docId = snapshot.docs[0].id;
        let currDoc = snapshot.docs[0].data();
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

const searchSpecimen = async (masterSpecimenId, siteCode, allSitesFlag) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', masterSpecimenId).get();
    if (snapshot.size === 1) {
        if (allSitesFlag) return snapshot.docs[0].data();
        const token = snapshot.docs[0].data().token;
        const response = await db.collection('participants').where('token', '==', token).get();
        const participantSiteCode = response.docs[0].data()['827220437']; 
        if (participantSiteCode === siteCode) return snapshot.docs[0].data();
    }
    
    return {};
}

/**
 * getSiteLocationBox returns array of a single box object that matches the site and boxId
 * @param {number} requestedSite - site code of the site
 * @param {string} boxId - boxId of the box
*/
const getSiteLocationBox = async (requestedSite, boxId) => {
    try {
        const snapshot = await db.collection('boxes')
                                .where(fieldMapping.loginSite.toString(), "==", requestedSite)
                                .where(fieldMapping.shippingBoxId.toString(), "==", boxId).get();
        const boxMatch = [];
        for(let document of snapshot.docs) {
            boxMatch.push(document.data());
        }
        return boxMatch;
    } catch (error) {
        throw new Error(`getSiteLocationBox() error: ${error.message}`);
    }
}

/**
 * getBiospecimenCollectionIdsFromBox returns an array of collectionIds from the box
 * @param {number} requestedSite - site code of the site
 * @param {string} boxId - boxId of the box
*/
const getBiospecimenCollectionIdsFromBox = async (requestedSite, boxId) => {
    try {
        const shipBoxMatch = await getSiteLocationBox(requestedSite, boxId);
        if (shipBoxMatch === undefined || shipBoxMatch.length === 0) return [];
        
        const shipBoxObj = shipBoxMatch[0];
        const collectionIdArray = [];
        const bagConceptIdList = Object.values(fieldMapping.bagContainerCids);

        for (let key in shipBoxObj) {
            // check if key is in bagConceptIdList array of conceptIds
            if (bagConceptIdList.includes(parseInt(key))) {
                const bagContainerContent = shipBoxObj[key]; 
                const bloodUrineScan = fieldMapping.tubesBagsCids.biohazardBagScan;
                const mouthwashScan = fieldMapping.tubesBagsCids.biohazardMouthwashBagScan;
                const orphanScan = fieldMapping.tubesBagsCids.orphanScan;
                // Loop through the bagContainerContent to find the collectionId
                for (let key in bagContainerContent) {
                    if (parseInt(key) === bloodUrineScan || 
                        parseInt(key) === mouthwashScan || 
                        parseInt(key) === orphanScan) {
                        if (bagContainerContent[key] !== '') {
                            // extract the collectionId and push to collectionIdArray
                            const collectionIdString = bagContainerContent[key].split(" ")[0];
                            // check if collectionIdString is already in, if it isn't push it
                            if (!collectionIdArray.includes(collectionIdString)) {
                                collectionIdArray.push(collectionIdString);
                            }
                            break;
                        } 
                    }   
                }
            } 
        }
        return collectionIdArray;
    } catch (error) {
        throw new Error("getBiospecimenCollectionIdsFromBox() error.", {cause: error});
    }
}

/** 
 * return an array of biospecimen documents that match the healthcare provider and collectionId from collectionIdArray
 * calls getBiospecimenCollectionIdsFromBox to get the collectionIdArray
 * query the biospecimen collection for documents that match the healthcare provider and collectionIds in collectionIdArray
 * @param {number} requestedSite - site code of the site 
 * @param {string} boxId - boxId of the box
*/
//TODO: extend to batch query for > 15 items in collectionIdArray
const searchSpecimenBySiteAndBoxId = async (requestedSite, boxId) => {
    try {
        const collectionIdArray = await getBiospecimenCollectionIdsFromBox(requestedSite, boxId);
        const snapshot = await db.collection('biospecimen')
                                .where(fieldMapping.healthCareProvider.toString(), "==", requestedSite)
                                .where(fieldMapping.collectionId.toString(), "in", collectionIdArray).get();
        const biospecimenDocs = [];

        if (snapshot.empty) return biospecimenDocs;

        for (let document of snapshot.docs) {
            biospecimenDocs.push(document.data());
        }
        return biospecimenDocs;
    } catch (error) {
        throw new Error("searchSpecimenBySiteAndBoxId() error.", {cause: error});
    }
}

const searchShipments = async (siteCode) => {
    const { reportMissingTube, submitShipmentFlag, no } = fieldMapping;
    const healthCareProvider = fieldMapping.healthCareProvider.toString();
    const tubesBagsCidKeys = swapObjKeysAndValues(tubesBagsCids);
    const snapshot = await db.collection('biospecimen').where(healthCareProvider, '==', siteCode).get();
    let shipmentData = [];

    if (snapshot.size !== 0) {
        for (let document of snapshot.docs) {
            let data = document.data();
            let keys = Object.keys(data);
            let isFound = false;

            for (let key of keys) {
                if (tubesBagsCidKeys[key]) {
                    let currJSON = data[key];
                    if (currJSON[reportMissingTube]) {
                        if (currJSON[reportMissingTube] === no) {
                            isFound = false;
                        }
                        isFound = true;
                    }
                    else if (currJSON[submitShipmentFlag]) {
                        isFound = true;
                    }
                }
            }
            if (isFound === false) shipmentData.push(data);
        }
        return shipmentData;
    }
}


const specimenExists = async (id) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', id).get();
    if(snapshot.size === 1) return true;
    else return false;
}

const boxExists = async (boxId, loginSite) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('789843387', '==', loginSite).get();
    if(snapshot.size === 1) return true;
    else return false;
}

const accessionIdExists = async (accessionId, accessionIdType, siteCode) => {
    const snapshot = await db.collection('biospecimen').where(accessionIdType, '==', accessionId).get();
    if(snapshot.size === 1) {
        const token = snapshot.docs[0].data().token;
        const response = await db.collection('participants').where('token', '==', token).get();
        const participantSiteCode = response.docs[0].data()['827220437'];
        if(participantSiteCode === siteCode) return snapshot.docs[0].data();
        else return false;
    }
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

/**
 * 
 * @param {Array<string>} boxIdArray - array of box ids to fetch 
 * @param {string} siteCode - site code of the user (number)
 * @param {transaction} transaction - firestore transation object
 * @returns boxes object with data and docRef
 * If boxIdArray.length > 15, chunk the array into multiple queries to support the use of 'in' operator.
 */
const getBoxesByBoxId = async (boxIdArray, siteCode, transaction = null) => {
    const shippingBoxId = `${fieldMapping.shippingBoxId}`;
    const loginSite = `${fieldMapping.loginSite}`;
    const chunkSize = 15;

    const getSnapshot = async (boxIds) => {
        if (transaction) {
            return transaction.get(db.collection('boxes')
                .where(shippingBoxId, 'in', boxIds)
                .where(loginSite, '==', siteCode));
        } else {
            return db.collection('boxes')
                .where(shippingBoxId, 'in', boxIds)
                .where(loginSite, '==', siteCode)
                .get();
        }
    };

    try {
        let resultsArray = [];

        if (boxIdArray.length > chunkSize) {
            const chunksToSend = [];
            for (let i = 0; i < boxIdArray.length; i += chunkSize) {
                chunksToSend.push(boxIdArray.slice(i, i + chunkSize));
            }

            const chunkPromises = chunksToSend.map(chunk => getSnapshot(chunk));
            const snapshots = await Promise.all(chunkPromises);

            snapshots.forEach(snapshot => {
                const docsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
                resultsArray.push.apply(resultsArray, docsArray);
            });

        } else {
            const snapshot = await getSnapshot(boxIdArray);
            resultsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
        }

        return resultsArray;

    } catch (error) {
        throw new Error(error);
    }
}

/**
 * Ship a batch of boxes using a transaction
 * Transaction: (1) Guarantees atomicity (2) Ensures data integrity (3) Automatically retries on initial failure
 * @param {Array} boxIdAndShipmentDataArray - array of objects with boxId and shipmentData
 * @param {number} siteCode - site code of the user (number)
 * @returns {boolean} true if successful, throws error otherwise
 */
const shipBatchBoxes = async (boxIdAndShipmentDataArray, siteCode) => {
    const boxIdToShipmentData = {};
    boxIdAndShipmentDataArray.forEach(item => {
        boxIdToShipmentData[item.boxId] = item.shipmentData;
    });

    const boxIdArray = Object.keys(boxIdToShipmentData);

    try {
        await db.runTransaction(async (transaction) => {
            const boxes = await getBoxesByBoxId(boxIdArray, siteCode, transaction);
    
            for (const box of boxes) {
                const boxData = box.data;
                const shipmentData = boxIdToShipmentData[boxData[fieldMapping.shippingBoxId]];

                if (shipmentData) {
                    shipmentData[fieldMapping.submitShipmentFlag] = fieldMapping.yes;
                    Object.assign(boxData, shipmentData);
                    transaction.update(box.docRef, boxData);
                }
            }
        });

        return true;
    } catch (error) {
        throw new Error(error);
    }
};

const shipBox = async (boxId, siteCode, shippingData, trackingNumbers) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('789843387', '==',siteCode).get();
    if(snapshot.size === 1) {
        let currDate = new Date().toISOString();
        shippingData['656548982'] = currDate;
        shippingData['145971562'] = 353358909;
        shippingData['959708259'] = trackingNumbers[boxId]
        const docId = snapshot.docs[0].id;
        await db.collection('boxes').doc(docId).update(shippingData);
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

const searchBoxes = async (institute, flag) => {
    const boxesCollection = db.collection('boxes');
    let snapshot = ``;

    if (flag && (institute === nciCode || institute == nciConceptId)) {
        if (flag === `bptl`) {
            snapshot = await boxesCollection.get();
        } else if (flag === `bptlPackagesInTransit`) {
            snapshot = await boxesCollection
                            .where(fieldMapping.submitShipmentFlag.toString(), "==", fieldMapping.yes)
                            .where(fieldMapping.siteShipmentReceived.toString(), "==", fieldMapping.no).get();
        }
    } else { 
        snapshot = await boxesCollection.where(fieldMapping.loginSite.toString(), '==', institute).get()
    }

    if (snapshot.size !== 0){
        return snapshot.docs.map(document => document.data());
    } else {
        return [];
    }
}

const searchBoxesByLocation = async (institute, location) => {
    console.log("institute" + institute);
    console.log("location" + location);
    const snapshot = await db.collection('boxes').where('789843387', '==', institute).where('560975149','==',location).get();
    console.log(snapshot);
    if(snapshot.size !== 0){
        let result = snapshot.docs.map(document => document.data());
        // console.log(JSON.stringify(result));
        let toReturn = result.filter(data => (!data.hasOwnProperty('145971562')||data['145971562']!='353358909'))
        return toReturn;
    }
    else{
        console.log("nothing to return");
        return [];
    }
    
}

const getSpecimenCollections = async (token, siteCode) => {
    const snapshot = await db.collection('biospecimen').where('token', '==', token).where('827220437', '==', siteCode).get();
    if(snapshot.size !== 0){
        return snapshot.docs.map(document => document.data());
    }
    
    return [];
}

const preQueryBuilder = (filters, query, trackingId, endDate, startDate, source, siteCode) => {
    if (Object.keys(filters).length === 0 && source === `bptlShippingReport`) {
        const currentDate = new Date(new Date().getTime()).toISOString();
        const dateTwoWeeksAgo = new Date(new Date().getTime() - (1209600000)).toISOString();
        return query.where('656548982', '>=', dateTwoWeeksAgo).where('656548982', '<=', currentDate)
    }
    else {
        return buildQueryWithFilters(query, trackingId, endDate, startDate, source, siteCode)
    }
}

const buildQueryWithFilters = (query, trackingId, endDate, startDate, source, siteCode) => {
    if (trackingId) query = query.where('959708259', '==', trackingId);
    if (endDate) query = query.where('656548982', '<=', endDate);
    if (startDate) query = query.where('656548982', '>=', startDate);
    if (source !== `bptlShippingReport`) query = query.where('789843387', '==', siteCode);
    return query
}

const getBoxesPagination = async (siteCode, body) => {
    const currPage = body.pageNumber;
    const orderByField = body.orderBy;
    const elementsPerPage = body.elementsPerPage;
    const filters = body.filters ?? ``;
    const source = body.source ?? ``;
    const startDate = filters.startDate ?? ``;
    const trackingId = filters.trackingId ?? ``;
    const endDate = filters.endDate ?? ``;
    try {
        let query = db.collection('boxes').where('145971562', '==', 353358909);
        query = preQueryBuilder(filters, query, trackingId, endDate, startDate, source, siteCode);
        query = query.orderBy(orderByField, 'desc').limit(elementsPerPage).offset(currPage * elementsPerPage);
        const snapshot = await query.get();
        const result = snapshot.docs.map(document => document.data());
        return result;
    } 
    catch (error) {
        console.error(error);
        return [];
    }
};


const getNumBoxesShipped = async (siteCode, body) => {
    const filters = body.filters ?? ``;
    const source = body.source ?? ``;
    const startDate = filters.startDate ?? ``;
    const trackingId = filters.trackingId ?? ``;
    const endDate = filters.endDate ?? ``;
    try {
        let query = db.collection('boxes').where('145971562', '==', 353358909);
        query = preQueryBuilder(filters, query, trackingId, endDate, startDate, source, siteCode);
        const snapshot = await query.get();
        const result = snapshot.docs.length;
        return result;
    } catch (error) {
        console.error(error);
        return new Error(error)
    }
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
            let values = '';
            if(conditions[obj]['equals']) {
                if(typeof conditions[obj]['equals'] == 'string') {
                    values = conditions[obj]['equals'];
                }
                else if(typeof conditions[obj]['equals'] == 'number') {
                    values = parseInt(conditions[obj]['equals']);
                }
                operator = '==';
            }
            if(conditions[obj]['notequals']) {
                if(typeof conditions[obj]['notequals'] == 'string') {
                    values = conditions[obj]['notequals'];
                }
                else if(typeof conditions[obj]['notequals'] == 'number') {
                    values = parseInt(conditions[obj]['notequals']);
                }
                operator = '!=';
            }
            if(conditions[obj]['greater']) {
                if(typeof conditions[obj]['greater'] == 'string') {
                    values = conditions[obj]['greater'];
                }
                else if(typeof conditions[obj]['greater'] == 'number') {
                    values = parseInt(conditions[obj]['greater']);
                }
                operator = '>';
            }
            if(conditions[obj]['greaterequals']) {
                if(typeof conditions[obj]['greaterequals'] == 'string') {
                    values = conditions[obj]['greaterequals'];
                }
                else if(typeof conditions[obj]['greaterequals'] == 'number') {
                    values = parseInt(conditions[obj]['greaterequals']);
                }
                operator = '>=';
            }
            if(conditions[obj]['less']) {
                if(typeof conditions[obj]['less'] == 'string') {
                    values = conditions[obj]['less'];
                }
                else if(typeof conditions[obj]['less'] == 'number') {
                    values = parseInt(conditions[obj]['less']);
                }
                operator = '<';
            }
            if(conditions[obj]['lessequals']) {
                if(typeof conditions[obj]['lessequals'] == 'string') {
                    values = conditions[obj]['lessequals'];
                }
                else if(typeof conditions[obj]['lessequals'] == 'number') {
                    values = parseInt(conditions[obj]['lessequals']);
                }
                operator = '<=';
            }
            query = query.where(obj, operator, values);
        }
        const participants = await query.get();
        return participants.docs.map(doc => doc.data());
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const notificationAlreadySent = async (token, notificationSpecificationsID) => {
    try {
        const snapshot = await db.collection('notifications').where('token', '==', token).where('notificationSpecificationsID', '==', notificationSpecificationsID).get();
        return snapshot.size !== 0;
    } catch (error) {
        return new Error(error);
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

/**
 * Save notification records to `notifications` collection.
 * @param {object[]} notificationRecordArray Array of notification records to be saved
 */
const saveNotificationBatch = async (notificationRecordArray) => {
  const chunkSize = 500; // batched write has a doc limit of 500
  const chunkArray = createChunkArray(notificationRecordArray, chunkSize);
  for (const recordChunk of chunkArray) {
    const batch = db.batch();
    try {
        for (const record of recordChunk) {
        const docId = record.uid + record.notificationSpecificationsID.slice(0, 6);
        const docRef = db.collection("notifications").doc(docId);
        batch.set(docRef, record);
      }

      await batch.commit();
    } catch (error) {
      throw new Error("saveNotificationBatch() error.", {cause: error});
    }
  }
};

/**
 * @param {string} specId ID of notification specification
 * @param {string[]} participantTokenArray Array of participant tokens for data updates
 */
const saveSpecIdsToParticipants = async (specId, participantTokenArray) => {
  const chunkSize = 30; // 'in' operator has size limit of 30
  const chunkArray = createChunkArray(participantTokenArray, chunkSize);

  for (const tokenChunk of chunkArray) {
    const batch = db.batch();
    try {
      const snapshot = await db.collection("participants").where("token", "in", tokenChunk).get();
      if (snapshot.empty) continue;
      snapshot.forEach((doc) => batch.update(doc.ref, {[`query.notificationSpecIdsUsed.${specId}`]: true}));
      await batch.commit();
    } catch (error) {
      throw new Error("saveSpecIdsToParticipants() error.", {cause: error});
    }
  }
};

const markNotificationAsRead = async (id, collection) => {
    const snapshot = await db.collection(collection).where('id', '==', id).get();
    const docId = snapshot.docs[0].id;
    await db.collection(collection).doc(docId).update({read: true});
}

const storeSSN = async (data) => {
    try{
        const response = await db.collection('ssn').where('uid', '==', data.uid).get();
        if(response.size === 1) {
            for(let doc of response.docs){
                await db.collection('ssn').doc(doc.id).update(data);
                return true;
            }
        } else {
            await db.collection('ssn').add(data);
            return true;
        }
    }
    catch(error){
        console.error(error);
        return new Error(error)
    }
    
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

const getEmailNotifications = async (scheduleAt) => {
    const snapshot = await db.collection('notificationSpecifications').where('scheduleAt', '==', scheduleAt).get();
    const notifications = [];
    snapshot.forEach(dt => {
        const notification = dt.data();
        if(!notifications.includes(notification.id) && notification.notificationType[0] == 'email') notifications.push(notification);
    })
    return notifications;
}

const getNotification = async (id) => {
    const snapshot = await db.collection('notificationSpecifications').where('id', '==', id).get();

    return snapshot.docs[0].data();
}

const addKitAssemblyData = async (data) => {
    try {
        await db.collection('kitAssembly').add(data);
        return true;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}


const updateKitAssemblyData = async (data) => {
    try {
        const snapShot = await db.collection('kitAssembly').where('687158491', '==', data['687158491']).get();

        if (snapShot.empty) return false
        const docId = snapShot.docs[0].id;
 
        await db.collection('kitAssembly').doc(docId).update({
            '194252513': data[fieldMapping.returnKitId],
            '259846815': data[fieldMapping.collectionCupId],
            '972453354': data[fieldMapping.returnKitTrackingNum],
            '690210658': data[fieldMapping.supplyKitId],
            '786397882': data[fieldMapping.collectionCardId]
        })
        return true;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const checkCollectionUniqueness = async (supplyId, collectionId) => {
    try {
        const supplySnapShot = await db.collection('kitAssembly').where('690210658', '==', supplyId).get();
        const collectionSnapShot = await db.collection('kitAssembly').where('259846815', '==', collectionId).get();
        if (supplySnapShot.docs.length === 0 && collectionSnapShot.docs.length === 0) {
            return true;
        } else if (supplySnapShot.docs.length !== 0) {
            return 'duplicate supplykit id';
        } else if (collectionSnapShot.docs.length !== 0) {
            return 'duplicate collection id';
        }
    } catch (error) {
        return new Error(error);
    }
};

const queryTotalAddressesToPrint = async () => {
    try {
        const snapShot = await db.collection('participants')
        .where('747006172', '==', 104430631) // withdraw consent
        .where('987563196', '==', 104430631) // deceased
       //.where('827220437', '==', 125001209) // KPCO
        .where('685002411.277479354', '==', 104430631) // mouthwash refusal
        .where('173836415.266600170.156605577', '==', 353358909) // Blood or Urine Collected
        .where('173836415.266600170.740582332', '>=', '2023-10-01T00:00:00.000Z') // Date/timestamp for Blood or Urine Collected
        .orderBy('173836415.266600170.740582332', 'desc')
        .get();
        return snapShot.docs.map(document => processParticipantData(document.data(), true));
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const eligibleParticipantsForKitAssignment = async () => {
    try {
        const snapshot = await db.collection("participants").where('173836415.266600170.8583443674.221592017', '==', '849527480').get();

        if(snapshot.size !== 0) return snapshot.docs.map(doc => processParticipantData(doc.data(), false));
        else return false;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const addKitStatusToParticipant = async (participantsCID) => {
    try {
        // Create an array of promises to update participants in parallel
        const updatePromises = participantsCID.map(async (participantCID) => {
            const snapshot = await db.collection("participants").where('Connect_ID', '==', parseInt(participantCID)).get();
            if (snapshot.size === 0) {
                // No matching document found, stop the update
                return false;
            }
            const docId = snapshot.docs[0].id;
            const prevParticipantObject = snapshot.docs[0].data()?.[173836415]?.[266600170];
            await db.collection("participants").doc(docId).update({
                '173836415': {
                    '266600170': {
                        ...prevParticipantObject,
                        '915179629': '664882224',
                        '8583443674': {
                            '221592017': '849527480'
                        }
                    }
                }
            });
        });

        // Wait for all update promises to complete
        await Promise.all(updatePromises);

        return true;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
};

const processParticipantData = (record, printLabel) => {
    const hasMouthwash = record[173836415][266600170][8583443674] !== undefined;
    const processedRecord = {
        first_name: record['399159511'],
        last_name: record['996038075'],
        address_1: record['521824358'],
        address_2: record['442166669'] || '',
        city: record['703385619'],
        state: record['634434746'],
        zip_code: record['892050548'],
        connect_id: record['Connect_ID'],
    };
    if ((!hasMouthwash && printLabel) || (hasMouthwash && !printLabel)) {
        return processedRecord;
    }
    else {
        return [];
    }
}

const assignKitToParticipant = async (data) => {
    try {
        const kitSnapshot = await db.collection("kitAssembly").where('690210658', '==', data['690210658']).where('221592017', '==', '517216441').get();

        if (kitSnapshot.size !== 1) {
            return false;
        }

        const kitDoc = kitSnapshot.docs[0];
        data['687158491'] = kitDoc.data()[687158491];
        const kitData = {
            '531858099': data['531858099'],
            '221592017': '241974920',
            '418571751': '266600170',
            'Connect_ID': parseInt(data['Connect_ID'])
        };

        await kitDoc.ref.update(kitData);

        const participantSnapshot = await db.collection("participants").where('Connect_ID', '==', parseInt(data['Connect_ID'])).get();

        if (participantSnapshot.size !== 1) {
            return false;
        }

        const participantDoc = participantSnapshot.docs[0];
        const prevParticipantObject = participantDoc.data()?.[173836415]?.[266600170];
        
        const updatedParticipantObject = {
            '173836415': {
                '266600170': {
                    ...prevParticipantObject,
                    '915179629': '534621077',
                    '8583443674': {
                        '379252329': '390351864', // mouthwash
                        '221592017': '241974920',
                        '687158491': data['687158491'],
                    }
                }
            }
        };

        await participantDoc.ref.update(updatedParticipantObject);

        return true;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
};

const processVerifyScannedCode = async (id) => {
    try {
        const snapShot = await db.collection('kitAssembly').where('531858099', '==', id).where('221592017', '==', '241974920').get();
        if (snapShot.docs.length === 1) {
            return { valid: true, UKID: snapShot.docs[0].data()[687158491] }
        }
        else { return false }
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const confirmShipmentKit = async (shipmentData) => {
    try {
        const kitSnapshot = await db.collection("kitAssembly").where('687158491', '==', shipmentData['687158491']).get();

        if (kitSnapshot.size === 0) {
            return false;
        }

        const kitDoc = kitSnapshot.docs[0];
        const kitData = {
            '221592017': '277438316',
            '661940160': shipmentData['661940160']
        };

        await kitDoc.ref.update(kitData);

        const participantSnapshot = await db.collection("participants").where('173836415.266600170.8583443674.687158491', '==', shipmentData['687158491']).get();

        if (participantSnapshot.size === 0) {
            return false;
        }

        const participantDoc = participantSnapshot.docs[0];
        const prevParticipantObject = participantDoc.data()[173836415][266600170][8583443674];
        const uid = participantDoc.data()['state']['uid'];
        const Connect_ID = participantDoc.data()['Connect_ID'];
        const prefEmail = participantDoc.data()['869588347'];
        const token = participantDoc.data()['token'];
        const ptName =  participantDoc.data()['153211406'] || participantDoc.data()['399159511']

        const updatedParticipantObject = {
            '173836415': {
                '266600170': {
                    '8583443674': {
                        ...prevParticipantObject,
                        '221592017': '277438316',
                        '661940160': shipmentData['661940160']
                    }
                }
            }
        };

        await participantDoc.ref.update(updatedParticipantObject);
        return { status: true, Connect_ID, token, uid, prefEmail, ptName };

    } catch (error) {
        console.error(error);
        return new Error(error);
    }
};

const storeKitReceipt = async (package) => {
    try {
        const kitSnapshot = await db.collection("kitAssembly").where('972453354', '==', package['972453354']).get();
        if (kitSnapshot.size === 0) {
            return false;
        }
        const kitDoc = kitSnapshot.docs[0];
        const Connect_ID = kitDoc.data()['Connect_ID'];
   
        const participantSnapshot = await db.collection("participants").where('173836415.266600170.8583443674.687158491', '==', kitDoc.data()[687158491]).get();
        const participantDoc = participantSnapshot.docs[0];
        const token = participantDoc.data()['token'];
        const uid = participantDoc.data()['state']['uid'];
        const site = participantDoc.data()['827220437'];
        const prefEmail = participantDoc.data()['869588347'];
        const ptName =  participantDoc.data()['153211406'] || participantDoc.data()['399159511']
        const surveyStatus = participantDoc.data()['547363263']

        const prevParticipantObject = participantDoc.data()[173836415][266600170][8583443674];
        const collectionId = package['259846815']?.split(' ')[0]
        const objectId = package['259846815']?.split(' ')[1]
        
        if (objectId === undefined || collectionId === undefined) {
            return { status: 'Check Collection ID' }
        }

        const biospecPkg = {
            '820476880': package['259846815'],
            '260133861': package['260133861'],
            '143615646': {
                '593843561': collectionId,
                '825582494': objectId,
                '826941471': package['826941471']
            },
            '678166505': package['678166505'],
            'Connect_ID': Connect_ID,
            '827220437': site,
            'token': token,
            'uid': uid
        }

        await db.collection('biospecimen').add(biospecPkg);

        await kitDoc.ref.update({
            '221592017': '375535639',
            '826941471': package['826941471'],
            '633640710': package['633640710']
        });

        await participantDoc.ref.update({
            '684635302': 353358909,
            '254109640': 353358909,
            '173836415.266600170.915179629': 103209024,
            '173836415.266600170.448660695': package['678166505'],
            '173836415.266600170.8583443674': {
                ...prevParticipantObject,
                '221592017': '375535639',
                '826941471': package['826941471']
            }
        });

        return { status: true, Connect_ID, token, uid, prefEmail, ptName, surveyStatus };

        } 
        catch (error) {
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

const getSiteAcronym = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        if(snapshot.size > 0) return snapshot.docs[0].data().acronym;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getSiteMostRecentBoxId = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        if (snapshot.size > 0) {
            const doc = snapshot.docs[0];
            return {
                docId: doc.id,
                mostRecentBoxId: doc.data().mostRecentBoxId
            };
        }
        return null;
    } catch (error) {
        console.error('Error in getSiteMostRecentBoxId', error);
        throw new Error('Error getting site most recent box id', { cause: error });
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

const storePackageReceipt = async (data) => {
    if (data.scannedBarcode.length === 12 || data.scannedBarcode.length === 34) {  
        const response = await setPackageReceiptFedex(data);
        return response;
    } else { 
        const response = await setPackageReceiptUSPS(data);
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
        const { bagConceptIDs } = require('./shared');
        let trackingNumber = data.scannedBarcode
        let collectionIdHolder = {}
        if (trackingNumber.length === 34) trackingNumber = trackingNumber.slice(12);
        const snapshot = await db.collection("boxes").where('959708259', '==', trackingNumber).get(); // find related box using tracking number
        
        if (snapshot.empty) return false;
        
        const docId = snapshot.docs[0].id;
        data['959708259'] = trackingNumber
        delete data.scannedBarcode

        await db.collection("boxes").doc(docId).update(data); // using the docids update the box with the received date
        
        for (const boxData of snapshot.docs) {
            const collectionIdKeys = boxData.data(); // grab all the collection ids
            for (const bag of bagConceptIDs) {
                if (bag in collectionIdKeys){
                    if (collectionIdKeys[bag]['787237543'] !== undefined || collectionIdKeys[bag]['223999569'] !== undefined || collectionIdKeys[bag]['522094118'] !== undefined) {
                        if (collectionIdKeys[bag]['787237543'] !== `` && collectionIdKeys[bag]['223999569'] === `` && collectionIdKeys[bag]['522094118'] === ``) {
                            collectionIdHolder[bag] = collectionIdKeys[bag]['787237543'].split(' ')[0]
                        }
                        if (collectionIdKeys[bag]['223999569'] !== `` && collectionIdKeys[bag]['787237543'] === `` && collectionIdKeys[bag]['522094118'] === ``) {
                            collectionIdHolder[bag] = collectionIdKeys[bag]['223999569'].split(' ')[0]
                        }
                        if (collectionIdKeys[bag]['522094118'] !== `` && collectionIdKeys[bag]['223999569'] === `` && collectionIdKeys[bag]['787237543'] === `` ) {
                            collectionIdHolder[bag] = collectionIdKeys[bag]['522094118'].split(' ')[0]
                        }
                    }
                }
            };
            await processReceiptData(collectionIdHolder, collectionIdKeys, data['926457119']);
        };
        return true;
    } catch(error){
        return new Error(error);
    }
}

const processReceiptData = async (collectionIdHolder, collectionIdKeys, dateTimeStamp) => {
    const miscTubeIdSet = new Set(['0050', '0051', '0052', '0053', '0054']);

    for (const key in collectionIdHolder) {
        try {
            let updateObject = {};
            const secondSnapshot = await db.collection("biospecimen").where('820476880', '==', collectionIdHolder[key]).get(); // find related biospecimen using collection id
            const docId = secondSnapshot.docs[0].id;
            const specimenData = secondSnapshot.docs[0].data();

            updateObject['926457119'] = dateTimeStamp;

            for (const element of collectionIdKeys[key]['234868461']) {
                //grab tube ids & map them to appropriate concept ids. If it's a misc tube (0050-0054), find tube's location in specimen to get the concept id.
                const tubeId = element.split(' ')[1];
                
                let conceptTube = collectionIdConversion[tubeId]; 
                if (miscTubeIdSet.has(tubeId)) {
                    conceptTube = Object.keys(specimenData).find(tubeKey => tubeConceptIds.includes(tubeKey) && specimenData[tubeKey][fieldMapping.objectId] === element);
                }

                if (conceptTube) {
                    const conceptIdTubes = `${conceptTube}.926457119`
                    updateObject[conceptIdTubes] = dateTimeStamp;
                }
            }
            await db.collection("biospecimen").doc(docId).update(updateObject);
        }
        catch(error){
            return new Error(error);
        }}
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

const processBsiData = async (tubeConceptIds, query) => {
    return await Promise.all(tubeConceptIds.map( async tubeConceptId => { // using await promise.all waits until all the ele in a map are processed
        const snapshot = await db.collection("biospecimen").where(`${tubeConceptId}.926457119`, '==', query).get();// perform query on tube level
        return snapshot.docs.map(doc => {
            let collectionIdInfo = {}
            collectionIdInfo['825582494'] = doc.data()[tubeConceptId]['825582494']
            collectionIdInfo['926457119'] = doc.data()[tubeConceptId]['926457119']
            collectionIdInfo['678166505'] = doc.data()['678166505']
            collectionIdInfo['Connect_ID'] = doc.data()['Connect_ID']
            // collectionIdInfo['789843387'] = i['789843387']
            collectionIdInfo['827220437'] = doc.data()['827220437']
            collectionIdInfo['951355211'] = doc.data()['951355211']
            collectionIdInfo['915838974'] = doc.data()['915838974']
            collectionIdInfo['650516960'] = doc.data()['650516960']
            collectionIdInfo['762124027'] = doc.data()[tubeConceptId]['762124027'] === undefined ? ``  : doc.data()[tubeConceptId]['762124027']
            collectionIdInfo['982885431'] = doc.data()[tubeConceptId]['248868659'] === undefined ? `` : doc.data()[tubeConceptId]['248868659']['982885431']
            return collectionIdInfo
        }) // push query results to holdBiospecimenMatches array       
    }));
}

const verifyUsersEmailOrPhone = async (req) => {
    const queries = req.query
    if(queries.email) {
        try {
            const response = await admin.auth().getUserByEmail(queries.email)
            return response ? true : false;
        }
        catch(error) {
            return false;
        }
        
    }
    if(queries.phone) {
        try {
            const phoneNumberStr = '+1' + queries.phone.slice(-10)
            const response = await admin.auth().getUserByPhoneNumber(phoneNumberStr)
            return response ? true : false;
        }
        catch(error) {
            return false;
        }
    }
}

const updateUsersCurrentLogin = async (req, uid) => {   
    const queries = req
    if (queries.email) {
        try {
            await admin.auth().updateUser(uid,
                {       email: queries.email,
                })
            return true
        }
        catch(error) {
            return error.errorInfo.code
        }
    }
    if (queries.phone) {
        try {
            const newPhone = `+1`+queries.phone.toString().trim();
            await admin.auth().updateUser(uid, 
            {       phoneNumber: newPhone,
            })
            return true
        }
        catch(error) {
                return error.errorInfo.code
        }  
    }

}

const updateUserEmailSigninMethod = async (email, uid) => {
    let newEmail = email
    newEmail = newEmail.toString().trim();
    try {
        await admin.auth().updateUser(uid, {
            providerToLink: {
            email: newEmail,
            uid: newEmail,
            providerId: 'email',
            },
            deleteProvider: ['phone']
        })
        return true
    }
    catch(error) {
        return error.errorInfo.code
    }    
}

const updateUserPhoneSigninMethod = async (phone, uid) => {
    let newPhone = phone
    newPhone = newPhone.toString().trim();
    newPhone = `+1`+newPhone
    try {
        await admin.auth().updateUser(uid, {
            providerToLink: {
                phoneNumber: newPhone,
                uid: newPhone,
                providerId: 'phone',
            },
            providersToUnlink: ['email'],
            deleteProvider: ['password', 'email']
        })
        return true
    }
    catch(error) {
        return error.errorInfo.code
    }
}

/**
 * queryDailyReportParticipants
 * @param {}
 * returns participants that are no more than 2 days old from the time of check in date/time
 * Using promises to resolve array of objects
 * object containes essential information Collection Location (951355211), Connect ID,
 * F+L Name (996038075 & 399159511), Check-In (840048338), Collection ID (820476880),
 * Collection Finalized(556788178), Check-Out (343048998)
 * Queried from Participants & Biospecimen table
 */

const queryDailyReportParticipants = async (sitecode) => {
    const twoDaysinMilliseconds = 172800000;
    const twoDaysAgo = new Date(new Date().getTime() - (twoDaysinMilliseconds)).toISOString();
    let query = db.collection('participants');
    try {
        const snapshot = await query.where('331584571.266600170.840048338', '>=', twoDaysAgo).where('827220437', '==', sitecode).get();
        if (snapshot.size !== 0) {
            const promises = snapshot.docs.map(async (document) => {
                return processQueryDailyReportParticipants(document);
            });
            return Promise.all(promises).then((results) => {
                return results.filter((result) => result !== undefined);
            });
        } else {
            return []
        }
    }
    catch(error) {
        return error.errorInfo
    }
};

const processQueryDailyReportParticipants = async (document) => {
    try {
        const secondSnapshot = await db.collection('biospecimen').where('Connect_ID', '==', document.data()['Connect_ID']).get();
        if (secondSnapshot.size !== 0) {
            const dailyReport = {};
            if (secondSnapshot.docs[0].data()['951355211'] !== undefined) {
                dailyReport['Connect_ID'] = document.data()['Connect_ID'];
                dailyReport['996038075'] = document.data()['996038075'];
                dailyReport['399159511'] = document.data()['399159511'];
                dailyReport['840048338'] = document.data()['331584571']['266600170']['840048338'];
                dailyReport['951355211'] = document.data()['951355211'];
                dailyReport['343048998'] = document.data()['331584571']['266600170']?.['343048998'];
                dailyReport['951355211'] = secondSnapshot.docs[0].data()['951355211'];
                dailyReport['820476880'] = secondSnapshot.docs[0].data()['820476880'];
                dailyReport['556788178'] = secondSnapshot.docs[0].data()['556788178'];
                
                return dailyReport;
            }
        }
    }
    catch(error) {
        return error.errorInfo
    }
};

const getRestrictedFields = async () => {
    const snapshot = await db.collection('siteDetails').where('coordinatingCenter', '==', true).get();
    return snapshot.docs[0].data().restrictedFields;
}

/**
 * This is for managing received boxes in BPTL only.
 * @param {string} receivedTimestamp - Timestamp of received date in format 'YYYY-MM-DDT00:00:00.000Z'. Ex: '2023-08-30T00:00:00.000Z'.
 * @returns {specimenData} - Array of specimen data objects.
 */
const getSpecimensByReceivedDate = async (receivedTimestamp) => {
    const { extractCollectionIdsFromBoxes, processSpecimenCollections } = require('./shared');
    try {
        const boxes = await getBoxesByReceivedDate(receivedTimestamp);
        const collectionIdArray = extractCollectionIdsFromBoxes(boxes);
        if (collectionIdArray.length === 0) {
            return [];
        }

        const specimenCollections = await getSpecimensByCollectionIds(collectionIdArray, null, true);
        const specimenData = processSpecimenCollections(specimenCollections, receivedTimestamp);

        return specimenData;
    } catch (error) {
        throw new Error("Error fetching specimens by received date.", { cause: error });
    }
}

/**
 * This is for managing received boxes in BPTL only.
 * @param {string} receivedTimestamp - Timestamp of received date in format 'YYYY-MM-DDT00:00:00.000Z'. Ex: '2023-08-30T00:00:00.000Z'. 
 * @returns list of boxes received on the given date.
 */
const getBoxesByReceivedDate = async (receivedTimestamp) => {
    const snapshot = await db.collection('boxes').where('926457119', '==', receivedTimestamp).get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Get biospecimen docs from collectionIdsArray (conceptId: 820476880). Ex: ['CXA123456', 'CXA234567', 'CXA345678']
 * @param {array} collectionIdsArray - Array of collection ids. Ex: ['CXA123456', 'CXA234567', 'CXA345678'].
 * @param {string} siteCode - Site code for the healthcare provider.
 * @param {boolean} isBPTL - True if the request is coming from BPTL, false if from site.
 * @returns {array} - Array of biospecimen data objects.
 * Max 30 disjunctions for 'in' queries: array length <= 30 for BPTL, <= 15 for site due to extra .where() clause in site query 
 */
const getSpecimensByCollectionIds = async (collectionIdsArray, siteCode, isBPTL = false) => {
    const getSnapshot = (collectionIds) => {
        let query = db.collection('biospecimen').where('820476880', 'in', collectionIds);
        if (!isBPTL) {
            query = query.where('827220437', '==', siteCode);
        }
        return query.get();
    }

    try {
        const chunkSize = isBPTL ? 30 : 15;
        let resultsArray = [];
        let chunksToSend = [];

        for (let i = 0; i < collectionIdsArray.length; i += chunkSize) {
            chunksToSend.push(collectionIdsArray.slice(i, i + chunkSize));
        }

        const chunkQueries = chunksToSend.map(chunk => getSnapshot(chunk));
        const snapshots = await Promise.all(chunkQueries);

        snapshots.forEach(snapshot => {
            const docsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
            resultsArray.push.apply(resultsArray, docsArray);
        });

        return resultsArray;

    } catch (error) {
        throw new Error("Error fetching specimens by collectionIds.", { cause: error });
    }
}

const processEventWebhook = async (event) => {
    if (event.gcloud_project !== process.env.GCLOUD_PROJECT) return;

    const date = new Date(event.timestamp * 1000).toISOString();
    console.log("Processing event at " + date);
    console.log(event);

    const response = await db
        .collection("sendgridTracking")
        .where("sg_message_id", "==", event.sg_message_id)
        .get();

    if (response.size > 0) {
        for (let doc of response.docs) {
            const eventRecord = {
                [`${event.event}_status`]: true,
                [`${event.event}_date`]: date,
                [`${event.event}_timestamp`]: event.timestamp,
            };
            if (["bounce", "dropped"].includes(event.event)) {
                eventRecord[`${event.event}_reason`] = event.reason;
            }
            await db
                .collection("sendgridTracking")
                .doc(doc.id)
                .update(eventRecord);
        }
    } else {
        const eventRecord = {
            [`${event.event}_status`]: true,
            [`${event.event}_date`]: date,
            [`${event.event}_timestamp`]: event.timestamp,
            connect_id: event.connect_id,
            email: event.email,
            notification_id: event.notification_id,
            sg_event_id: event.sg_event_id,
            sg_message_id: event.sg_message_id,
            token: event.token,
        };
        if (["bounce", "dropped"].includes(event.event)) {
            eventRecord[`${event.event}_reason`] = event.reason;
        }
        await db.collection("sendgridTracking").add(eventRecord);
    }
};

module.exports = {
    updateResponse,
    retrieveParticipants,
    verifyIdentity,
    retrieveUserProfile,
    retrieveUserSurveys,
    retrieveConnectID,
    surveyExists,
    updateSurvey,
    storeSurvey,
    createRecord,
    recordExists,
    validateIDToken,
    verifyTokenOrPin,
    linkParticipanttoFirebaseUID,
    participantExists,
    sanityCheckConnectID,
    sanityCheckPIN,
    individualParticipant,
    getChildren,
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
    accessionIdExists,
    addBoxAndUpdateSiteDetails,
    updateBox,
    searchBoxes,
    shipBatchBoxes,
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
    removeParticipantsDataDestruction,
    removeUninvitedParticipants,
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
    getNotification,
    getEmailNotifications,
    getKitAssemblyData,
    storeSiteNotifications,
    getCoordinatingCenterEmail,
    getSiteEmail,
    getSiteAcronym,
    getSiteMostRecentBoxId,
    retrieveSiteNotifications,
    addPrintAddressesParticipants,
    getParticipantSelection,
    shipKits,
    storePackageReceipt,
    getBptlMetrics,
    getBptlMetricsForShipped,
    getRestrictedFields,
    sendClientEmail,
    verifyUsersEmailOrPhone,
    retrieveRefusalWithdrawalParticipants,
    updateUserPhoneSigninMethod,
    updateUserEmailSigninMethod,
    updateUsersCurrentLogin,
    queryDailyReportParticipants,
    saveNotificationBatch,
    saveSpecIdsToParticipants,
    getSpecimensByReceivedDate,
    getSpecimensByCollectionIds,
    getBoxesByBoxId,
    searchSpecimenBySiteAndBoxId,
    getUnshippedBoxes,
    getSpecimensByBoxedStatus,
    addKitAssemblyData,
    updateKitAssemblyData,
    queryTotalAddressesToPrint,
    checkCollectionUniqueness,
    processVerifyScannedCode,
    assignKitToParticipant,
    confirmShipmentKit,
    storeKitReceipt,
    addKitStatusToParticipant,
    eligibleParticipantsForKitAssignment,
    processEventWebhook
}
