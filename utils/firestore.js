const admin = require('firebase-admin');
const { Transaction, FieldPath, FieldValue } = require('firebase-admin/firestore');
//admin.initializeApp();
const serviceAccount = require("../../../Code/Secrets/firebase-sdk-dev.json");
admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true }); // Skip keys with undefined values instead of erroring
const { tubeConceptIds, collectionIdConversion, swapObjKeysAndValues, batchLimit, listOfCollectionsRelatedToDataDestruction, createChunkArray, twilioErrorMessages, cidToLangMapper, printDocsCount, getFiveDaysAgoDateISO, conceptMappings } = require('./shared');
const fieldMapping = require('./fieldToConceptIdMapping');
const { isIsoDate } = require('./validation');
const {getParticipantTokensByPhoneNumber} = require('./bigquery');

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
  printDocsCount(snapshot, "verifyTokenOrPin");
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
        const snapshot = await db.collection('participants').where('state.uid', '==', uid).get();
        printDocsCount(snapshot, "participantExists");
        if(snapshot.size === 0){
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
        const snapshot = await db.collection('participants').where('state.uid', '==', uid).get();
        printDocsCount(snapshot, "updateResponse");

        if (snapshot.size !== 1) {
            throw new Error(`updateResponse expected 1 document, found ${snapshot.size}. uid: ${uid}`);
        }

        await snapshot.docs[0].ref.update(data);
        return true;
    }
    catch(error){
        console.error(`Error in updateResponse: ${error}`);
        return new Error(`Error in updateResponse: ${error}`);
    }
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
        const snapshot = await db.collection('participants').where('state.studyId', '==', studyId).where('827220437', '==', siteCode).get();
        printDocsCount(snapshot, "recordExists");
        if (snapshot.size === 1) {
            return snapshot.docs[0].data();
        }

        return false;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const validateSiteSAEmail = async (saEmail) => {
    try{
        const snapshot = await db.collection('siteDetails')
                                .where('saEmail', '==', saEmail)
                                .get();
        printDocsCount(snapshot, "validateSiteSAEmail");
        if(snapshot.size === 1) {
            return snapshot.docs[0].data();
        }

        return false;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const getParticipantData = async (token, siteCode, isParent) => {
    try{
        const operator = isParent ? 'in' : '==';
        const snapshot = await db.collection('participants')
                                .where('token', '==', token)
                                .where('827220437', operator, siteCode)
                                .get();
        printDocsCount(snapshot, "getParticipantData");
        if (snapshot.size === 1) {
            return {id: snapshot.docs[0].id, data: snapshot.docs[0].data()};
        }

        return false;
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

const resetParticipantHelper = async (uid, saveToDb) => {
    // Get information for user + reset to a pre-survey and specimen point for testing
    const toDelete = {};
    let obj = {};
    await db.runTransaction(async (transaction) => {
        const participantQuery = db.collection('participants').where('state.uid', '==', uid);
        const snapshot = await transaction.get(participantQuery);
        if (snapshot.size === 0) {
            // No matching document found, stop the update
            return false;
        }



        const { defaultFlags, defaultStateFlags, moduleConceptsToCollections } = require('./shared');

        const userId = snapshot.docs[0].id;
        const prevUserData = snapshot.docs[0].data();
        // These keys are the keys generated in the course of a participant registering
        // and then passing through the consent forms and submitting their profile
        // then the account being verified.
        // Basically, this resets the user to exactly once they've completed all that, before
        // any surveys have been answered or specimens submitted.
        let keysToPreserve = [
            fieldMapping.iDoNotHaveAPIN,
            fieldMapping.healthCareProvider,
            fieldMapping.heardAboutStudyFrom,
            fieldMapping.dataDestruction.consentFirstName,
            fieldMapping.dataDestruction.consentMiddleName,
            fieldMapping.dataDestruction.consentLastName,
            fieldMapping.dataDestruction.consentSuffixName,
            fieldMapping.dataDestruction.userProfileNameFirstName,
            fieldMapping.dataDestruction.userProfileNameMiddleName,
            fieldMapping.dataDestruction.userProfileNameLastName,
            fieldMapping.dataDestruction.userProfileNameSuffixName,
            'query',
            fieldMapping.autogeneratedConsentDate,
            fieldMapping.participantMap.consentFormSubmitted,
            fieldMapping.dataDestruction.informedConsentDateSigned,
            fieldMapping.dataDestruction.informedConsentVersion,
            fieldMapping.dataDestruction.hipaaAuthorizationDateSigned,
            fieldMapping.dataDestruction.hipaaAuthorizationFlag,
            fieldMapping.dataDestruction.hipaaAuthorizationVersion,
            fieldMapping.dataDestruction.firebaseAuthenticationEmail,
            fieldMapping.firebaseAuthenticationFirstAndLastName,
            fieldMapping.authenticationPhone,
            fieldMapping.signInMechanism,
            fieldMapping.preferredLanguage,
            fieldMapping.preferredName,
            fieldMapping.dataDestruction.birthMonth,
            fieldMapping.dataDestruction.birthDay,
            fieldMapping.dataDestruction.birthYear,
            fieldMapping.dataDestruction.dateOfBirth,
            fieldMapping.cellPhone,
            fieldMapping.homePhone,
            fieldMapping.otherPhone,
            fieldMapping.prefEmail,
            fieldMapping.additionalEmail1,
            fieldMapping.additionalEmail2,
            fieldMapping.additionalEmail3,
            fieldMapping.address1,
            fieldMapping.address2,
            fieldMapping.city,
            fieldMapping.state,
            fieldMapping.zip,
            fieldMapping.canWeVoicemailMobile,
            fieldMapping.canWeVoicemailHome,
            fieldMapping.canWeVoicemailOther,
            fieldMapping.canWeText,
            fieldMapping.prefContactMethod,
            fieldMapping.haveYouEverBeenDiagnosedWithCancer,
            fieldMapping.whatYearWereYouDiagnosed,
            fieldMapping.whatTypeOfCancer,
            fieldMapping.anyCommentsAboutYourCancerDiagnosis,
            fieldMapping.derivedAge,
            fieldMapping.dataDestruction.userProfileSubmittedFlag,
            fieldMapping.autogeneratedProfileSubmittedTime,
            fieldMapping.participantMap.consentFormSubmitted,
            fieldMapping.verificationStatus,
            fieldMapping.autogeneratedSignedInTime,
            fieldMapping.autogeneratedVerificationStatusUpdatedTime,
            // These are deprecated but left in to ensure data consistency
            983784715, 
            700668490,
            430184574,
            507120821,
            383945929
        ];
        // Pulling these out specifically instead of putting them in the above array
        // because they're used in subsequent logic
        const { token, Connect_ID } = prevUserData;
        obj = {
            state: {
                uid,
                ...defaultStateFlags
            },
            [fieldMapping.participantMap.signedInFlag]: fieldMapping.yes,
            token,
            Connect_ID,
            [fieldMapping.autogeneratedRecruitmentType]: fieldMapping.passive, // defaulting it as passive
            [fieldMapping.autogeneratedRecruitmentTypeTime]: (new Date()).toISOString(),
            ...defaultFlags
        }
        keysToPreserve.forEach(key => {
            if(typeof prevUserData[key] !== undefined) {
                obj[key] = prevUserData[key];
            }
        });

        // Get other documents created by this user which should be removed

        const userSurveyPromises = Object.keys(moduleConceptsToCollections).map((concept) => {
            return new Promise(async (resolve, reject) => {
                try {
                    const docQuery = db.collection(moduleConceptsToCollections[concept]).where('uid', '==', uid);
                    const docSnapshot = await transaction.get(docQuery);
        
                    if (docSnapshot.size > 0) {
                        toDelete[moduleConceptsToCollections[concept]] = docSnapshot.docs.map(doc => doc.id);
                    }
                    return resolve();
                } catch(err) {
                    reject(err);
                }
            });
        });

        const userNotificationsPromise = new Promise(async (resolve, reject) => {
            try {
                const notifQuery = db.collection("notifications").where("uid", "==", uid);
                const notifSnapshot = await transaction.get(notifQuery);
                toDelete.notifications = notifSnapshot.docs.map(doc => doc.id);
                return resolve();
            } catch (err) {
                reject(err);
            }
        });

        const userBiospecimenPromise = new Promise(async (resolve, reject) => {
            try {
                const biospecimenQuery = db.collection('biospecimen').where('token', '==', token);
                const biospecimenSnapshot = await transaction.get(biospecimenQuery);
                toDelete.biospecimen = biospecimenSnapshot.docs.map(doc => doc.id);
                biospecimensToDelete = biospecimenSnapshot.docs.map(doc => doc.data());
                return resolve();
            } catch (err) {
                reject(err);
            }
        });

        const userCancerOccurrencesPromise = new Promise(async (resolve, reject) => {
            try {
                const cancerOccurrencesQuery = db.collection('cancerOccurrence').where('token', '==', token);
                const cancerOccurrencesSnapshot = await transaction.get(cancerOccurrencesQuery);
                toDelete.cancerOccurrence = cancerOccurrencesSnapshot.docs.map(doc => doc.id);
                return resolve();
            } catch (err) {
                reject(err);
            }
        });

        const kitAssemblyPromise = new Promise(async (resolve, reject) => {
            try {
                const kitAssemblyQuery = db.collection('kitAssembly').where('Connect_ID', '==', Connect_ID);
                const kitAssemblySnapshot = await transaction.get(kitAssemblyQuery);
                toDelete.kitAssembly = kitAssemblySnapshot.docs.map(doc => doc.id);
                return resolve();
            } catch (err) {
                reject(err);
            }
        });

        await Promise.all([Promise.all(userSurveyPromises), userNotificationsPromise, userBiospecimenPromise, userCancerOccurrencesPromise, kitAssemblyPromise]);

        if (saveToDb) {
            const participantDoc = db.collection('participants').doc(userId);
            // These aren't going to ever have enough records to require delete batching
            const deletionDocsArray = [];
            await Promise.all(Object.keys(toDelete).map(async (docType) => {
                let ids = toDelete[docType] || [];
                if (!ids.length) {
                    return;
                }
                const docQuery = db.collection(docType)
                    .where(FieldPath.documentId(), 'in', ids);
                const query = await transaction.get(docQuery);
                query.docs.forEach(doc => deletionDocsArray.push(doc));
                return;
            }));
            // Transactions require all reads happen before writes for some reason, hence this structure
            const participantUpdatePromise = transaction
                .set(participantDoc, obj, {
                    merge: false
                });
            const deletePromises = deletionDocsArray.map(doc => doc && doc.ref ? transaction.delete(doc.ref) : Promise.resolve());
            await Promise.all([participantUpdatePromise, Promise.all(deletePromises)]);
        }
        return;
    });
    return { data: obj, deleted: toDelete };
}

/**
 * Retrieves participants from a Firestore collection based on specified conditions and pagination options.
 *
 * @async
 * @function retrieveParticipants
 * @param {string} siteCode - The code representing the current site.
 * @param {string} type - The type of participants to retrieve (e.g., "verified", "notyetverified", "cannotbeverified", "active", "notactive", "passive", "all", "profileNotSubmitted", "consentNotSubmitted", "notSignedIn").
 * @param {boolean} isParent - Indicates if the current user is a parent. Used to determine the 'where' operator for the site field.
 * @param {number} limit - The maximum number of documents to retrieve.
 * @param {string} [cursor] - The ID of the last document retrieved in a previous request, used for pagination.
 * @param {string} site - An optional site filter. If provided, site filtering will use equality. Otherwise, it may use 'in' or '==' depending on `isParent`.
 * @param {string} [from] - A lower bound for filtering documents by the `fromTo` field defined in the conditions. If provided, only documents with `fromTo` >= `from` are returned.
 * @param {string} [to] - An upper bound for filtering documents by the `fromTo` field defined in the conditions. If provided, only documents with `fromTo` <= `to` are returned.
 * @returns {Promise<{docs: Object[], cursor: string}>} An object containing:
 *   - `docs`: An array of participant document data.
 *   - `cursor`: The ID of the last document in the returned set (useful for pagination).
 *
 * @throws {Error} Will throw an error if the query or document retrieval fails.
 */
const retrieveParticipants = async (siteCode, type, isParent, limit, cursor, from, to) => {
    try{
        const conditions = {
            'verified': {
                where: [['821247024', '==', 197316935], ['699625233', '==', 353358909]],
                orderBy: ['Connect_ID', 'asc'],
                fromTo: '914594314'
            },
            'notyetverified': {
                where: [['821247024', '==', 875007964], ['699625233', '==', 353358909]],
                orderBy: ['Connect_ID', 'asc'],
                fromTo: '914594314'
            },
            'cannotbeverified': {
                where: [['821247024', '==', 219863910], ['699625233', '==', 353358909]],
                orderBy: ['Connect_ID', 'asc'],
                fromTo: '914594314'
            },
            'active': {
                where: [['512820379', '==', 486306141]],
                orderBy: ['821247024', 'asc'],
                fromTo: '914594314'
            },
            'notactive': {
                where: [['512820379', '==', 180583933]],
                orderBy: ['821247024', 'asc'],
                fromTo: '914594314'
            },
            'passive': {
                where: [['512820379', '==', 854703046]],
                orderBy: ['821247024', 'asc'],
                fromTo: '914594314'
            },
            'all': {
                orderBy: ['821247024', 'asc'],
                fromTo: '914594314'
            },
            'profileNotSubmitted': {
                where: [['699625233', '==', 104430631], ['919254129', '==', 353358909]],
                orderBy: ['821247024', 'asc']
            },
            'consentNotSubmitted': {
                where: [['699625233', '==', 104430631], ['919254129', '==', 104430631], ['230663853', '==', 353358909]],
                orderBy: ['821247024', 'asc']
            },
            'notSignedIn': {
                where: [['699625233', '==', 104430631], ['919254129', '==', 104430631], ['230663853', '==', 104430631]],
                orderBy: ['821247024', 'asc']
            }
        };

        const applyConditions = async (query, type, siteCode, limit, cursor, from, to) => {
            const queryConditions = conditions[type];
            const { where = [], orderBy, fromTo } = queryConditions;

            where.forEach(([field, operation, value]) => {
                query = query.where(field, operation, value);
            });

            query = query.where('827220437', isParent ? 'in' : '==', siteCode);
          
            if (orderBy) query = query.orderBy(...orderBy);
          
            if (fromTo && (from || to)) {
                query = query.orderBy(fromTo, 'desc');

                if (from) query = query.where(fromTo, '>=', from);
                if (to)   query = query.where(fromTo, '<=', to);
            }

            if (cursor) {
                const ref = db.collection('participants').doc(cursor);
                const doc = await ref.get();
    
                if (doc.exists) {
                    query = query.startAfter(doc);
                }
                else {
                    new Error(`Document with ID ${cursor} not found`);
                }
            }

            query = query.limit(limit);
          
            return query;
        };

        let query = await applyConditions(db.collection('participants'), type, siteCode, limit, cursor, from, to);

        let snapshot = await query.get();
        printDocsCount(snapshot, `retrieveParticipants`);

        const results = {};

        results.docs = snapshot.docs.map(doc => doc.data());
        if (snapshot.docs.length > 0 && snapshot.docs.length === limit) {
            results.cursor = snapshot.docs[snapshot.docs.length - 1].id;
        } 

        return results;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

// TODO: Avoid using `offset` for pagination, because offset documents are still read and charged.
const retrieveRefusalWithdrawalParticipants = async (siteCode, isParent, concept, limit, cursor) => {
    try {

        if (cursor) {
            const doc = await getCursorDocumnet('participants', cursor);
        }
        

        const snapshot = await db.collection('participants')
                                .where('827220437', isParent ? 'in' : '==', siteCode)
                                .where(concept, '==', 353358909)
                                .orderBy('Connect_ID', 'asc')
                                .limit(limit)
                                .get();                 
        printDocsCount(snapshot, `retrieveRefusalWithdrawalParticipants`);

        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error(error);
        return new Error(error)
    }
}

const getCursorDocumnet = async (collection, cursor) => {
    try {
        const ref = db.collection(collection).doc(cursor);
        const doc = await ref.get();

        if (doc.exists) {
            return doc;
        }
        else {
            return new Error(`Document with ID ${cursor} not found`);
        }
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

// TODO: Avoid using `offset` for pagination, because offset documents are still read and charged.
const retrieveParticipantsEligibleForIncentives = async (siteCode, roundType, isParent, limit, page) => {
    try {

        const operator = isParent ? 'in' : '==';
        const offset = (page-1)*limit;

        const { incentiveConcepts } = require('./shared');
        const object = incentiveConcepts[roundType]
        
        const snapshot = await db.collection('participants')
                                .where('827220437', operator, siteCode)
                                .where('821247024', '==', 197316935)
                                .where(`${object}.222373868`, "==", 353358909)
                                .where(`${object}.648936790`, '==', 104430631)
                                .where(`${object}.648228701`, '==', 104430631)
                                .orderBy('Connect_ID', 'asc')
                                .offset(offset)
                                .limit(limit)
                                .get();
        printDocsCount(snapshot, `retrieveParticipantsEligibleForIncentives; offset: ${offset}`);

        return snapshot.docs.map(document => {
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
            const snapshot =
                collection === "notifications" || collection === "ssn"
                    ? await query.where("token", "==", token).get()
                    : await query.where("Connect_ID", "==", connectID).get();
            printDocsCount(snapshot, "removeDocumentFromCollection");

            if (snapshot.size !== 0) {
                for (const dt of snapshot.docs) {
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
        const stubFieldArray = [
            ...Object.values(fieldMapping.dataDestruction).map(id => id.toString()),
            "query",
            "pin",
            "token",
            "state",
            "Connect_ID",
        ];

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
        printDocsCount(currSnapshot, "removeParticipantsDataDestruction");

        // Check each participant if they are already registered or more than 60 days from the date of their request
        // then the system will delete their data except the stub records and update the dataHasBeenDestroyed flag to yes.
        for (const doc of currSnapshot.docs) {
            const participant = doc.data();
            const participantId = doc.id;
            const timeDiff = isIsoDate(participant[dateRequestedDataDestroyCId])
                ? new Date().getTime() -
                  new Date(participant[dateRequestedDataDestroyCId]).getTime()
                : 0;

            if (
                participant[destroyDataCategoricalCId] ===
                    requestedAndSignCId ||
                timeDiff > millisecondsWait
            ) {
                const updatedData = {};
                let hasRemovedField = false;
                const fieldKeys = Object.keys(participant);
                fieldKeys.forEach((key) => {
                    if (!stubFieldArray.includes(key)) {
                        updatedData[key] = admin.firestore.FieldValue.delete();
                        hasRemovedField = true;
                    } else {
                        if (key === "query" || key === "state") {
                            const subFieldKeys = Object.keys(participant[key]);
                            subFieldKeys.forEach((subKey) => {
                                if (!subStubFieldArray.includes(subKey)) {
                                    updatedData[`${key}.${subKey}`] = admin.firestore.FieldValue.delete();
                                }
                            });
                        }
                    }
                });
                if (hasRemovedField) {
                    updatedData[dataHasBeenDestroyed] = fieldMapping.yes;
                    updatedData[fieldMapping.participationStatus] = fieldMapping.participantMap.dataDestroyedStatus;
                    count++;
                }
                await db.collection('participants').doc(participantId).update(updatedData);
                await removeDocumentFromCollection(
                    participant["Connect_ID"],
                    participant["token"]
                );
            }
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
            const snapshot = await db
              .collection("participants")
              .where(uninvitedRecruitsCId, "==", fieldMapping.yes)
              .limit(batchLimit)
              .get();
            printDocsCount(snapshot, "removeUninvitedParticipants");

            willContinue = snapshot.docs.length === batchLimit;
            const batch = db.batch();
            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
                count++
            }
        
            await batch.commit();
        }

        console.log(`Successfully deleted ${count} uninvited participants`)
    } catch (error) {
        console.error(`Error occurred when deleting documents: ${error}`);
    }
}

/**
 * Get site codes of children entities
 * @param {string} id - Entity ID
 */
const getChildren = async (id) => {
    try{
        const snapshot = await db.collection('siteDetails')
                                .where('state.parentID', 'array-contains', id)
                                .get();
        printDocsCount(snapshot, "getChildren");

        if(snapshot.size > 0) {
            /** @type {number[]} */
            const siteCodes = [];
            snapshot.docs.forEach(document => {
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
  const verificationStatus = fieldMapping.verificationStatus.toString();
  try {
    const snapshot = await db
      .collection("participants")
      .where("token", "==", token)
      .where("827220437", "==", siteCode)
      .select(verificationStatus)
      .get();
    printDocsCount(snapshot, "verifyIdentity");

    if (snapshot.size > 0) {
      const doc = snapshot.docs[0];
      const existingValue = doc.data()[verificationStatus];
      const { conceptMappings } = require("./shared");
      const newValue = conceptMappings[type];
      if ([fieldMapping.notVerified, fieldMapping.outreachTimeOut].indexOf(existingValue) === -1) {
        return new Error(`Verification status cannot be changed from ${existingValue} to ${newValue}`);
      }

      let data = {
        [verificationStatus]: newValue,
        [fieldMapping.autogeneratedVerificationStatusUpdatedTime]: new Date().toISOString(),
      };

      if (existingValue === fieldMapping.notVerified && type === "verified") {
        data[fieldMapping.cancerScreeningHistorySurveyStatus] = fieldMapping.notStarted;
      }

      await doc.ref.update(data);
      return true;
    } else {
      return new Error("Invalid token!");
    }
  } catch (error) {
    console.error(error);
    return new Error(error);
  }
};

const retrieveUserProfile = async (uid) => {
    try{
        const snapshot = await db.collection('participants')
                                .where('state.uid', '==', uid)
                                .get();
        printDocsCount(snapshot, "retrieveUserProfile");

        if(snapshot.size > 0) {
            let data = snapshot.docs[0].data();
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
        printDocsCount(snapshot, "retrieveConnectID");

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

/**
 * Fetches the participant's survey data from Firestore.
 * @param {String} uid - participant's uid
 * @param {Array} concepts - array of concepts IDs to retrieve
 * @returns {Object} - object with concept IDs as keys and data as values
 */
const retrieveUserSurveys = async (uid, concepts) => {
    try {
        let surveyData = {};
        const { moduleConceptsToCollections } = require('./shared');

        const surveyPromises = concepts.map(async (concept) => {
            if (!moduleConceptsToCollections[concept]) {
                return null;
            }

            try {
                const snapshot = await db.collection(moduleConceptsToCollections[concept])
                    .where('uid', '==', uid)
                    .get();
                printDocsCount(snapshot, "retrieveUserSurveys");

                if (snapshot.size > 0) {
                    return { concept, data: snapshot.docs[0].data() };
                }

                return null;
            } catch (error) {
                console.error(`Error fetching ${concept} survey data: ${error}`);
                return null;
            }
        });

        const surveyDataArray = await Promise.all(surveyPromises);

        surveyDataArray.filter(surveyPromiseResult => surveyPromiseResult !== null)
            .forEach(({ concept, data }) => {
                surveyData[concept] = data;
            });

        return surveyData;
    } catch (error) {
        console.error(error);
        throw new Error(`Error fetching user surveys: ${error}`);
    }
}

const surveyExists = async (collection, uid) => {
    const snapshot = await db.collection(collection).where('uid', '==', uid).get();
    printDocsCount(snapshot, "surveyExists");

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
        printDocsCount(snapshot, "sanityCheckConnectID");

        return snapshot.size === 0;
    }
    catch(error){
        console.error(error);
        return new Error(error);
    }
}

const sanityCheckPIN = async (pin) => {
    try{
        const snapshot = await db.collection('participants').where('pin', '==', pin).get();
        printDocsCount(snapshot, "sanityCheckPIN");
        
        return snapshot.size === 0;
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
        printDocsCount(snapshot, "individualParticipant");
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
        printDocsCount(snapshot, "updateParticipantRecord");
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
        const snapshot = await db.collection('participants').where('827220437', '==', siteCode).get();
        printDocsCount(snapshot, "deleteFirestoreDocuments");

        if(snapshot.size !== 0){
            snapshot.docs.forEach(async dt =>{ 
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
    const snapshot = await db.collection('notificationRegistration')
                            .where('notificationToken', '==', token)
                            .get();
    printDocsCount(snapshot, "notificationTokenExists");

    if(snapshot.size === 1){
        return snapshot.docs[0].data().uid;
    }
    else {
        return false;
    }
}

/**
 * Get all notifications to a user, based on uid.
 * @param {string} uid
 */
const retrieveUserNotifications = async (uid) => {
  const snapshot = await db
    .collection("notifications")
    .where("uid", "==", uid)
    .orderBy("notification.time", "desc")
    .get();
  printDocsCount(snapshot, "retrieveUserNotifications");

  return snapshot.docs.map((doc) => doc.data());
};

const retrieveSiteNotifications = async (siteId, isParent) => {
    try {
        let query = db.collection('siteNotifications');
        if(!isParent) query = query.where('siteId', '==', siteId);
        const snapshot = await query.orderBy('notification.time', 'desc')
                                    .get();
        printDocsCount(snapshot, "retrieveSiteNotifications");
                            
        if(snapshot.size > 0){
            return snapshot.docs.map(document => {
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
 * @param {Object} queries - The query object.
 * @param {string} siteCode - The site code.
 * @param {boolean} isParent - regulates access based on Whether the user is a parent or not.
 * @returns {Array<object>} - An array of participant objects.
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
        for (const key in queryKeys) {
            if (key === 'firstName' || key === 'lastName') {
                const path = `query.${key}`;
                const queryValue = key === 'firstName' ? queries.firstName : queries.lastName;
                participantQuery = participantQuery.where(path, 'array-contains', queryValue);
            }
            else if (key === 'email' || key === 'phone') {
                const path = `query.${key === 'email' ? 'allEmails' : 'allPhoneNo'}`;
                const queryValue = key === 'email' ? queries.email : queries.phone;
                participantQuery = participantQuery.where(path, 'array-contains', queryValue);
            }
            else if (key === 'dob') participantQuery = participantQuery.where('371067537', '==', queries.dob);
            else if (key === 'connectId') participantQuery = participantQuery.where('Connect_ID', '==', parseInt(queries.connectId));
            else if (key === 'token') participantQuery = participantQuery.where('token', '==', queries.token);
            else if (key === 'studyId') participantQuery = participantQuery.where('state.studyId', '==', queries.studyId);
            else if (key === 'checkedIn') participantQuery = participantQuery.where('331584571.266600170.135591601', '==', 353358909);
            else if (key === 'onlyActive' && queries[key] === true) participantQuery = participantQuery.where('747006172', '==', 104430631);
            else if (key === 'onlyVerified' && queries[key] === true) participantQuery = participantQuery.where('821247024', '==', 197316935);
        }

        return participantQuery;
    }   

    // This executes each query and pushes the data to the fetchedResults array.
    const executeQuery = async (query) => {
        const operator = isParent ? 'in' : '==';
        const snapshot = await (queries['allSiteSearch'] === 'true' ? query.get() : query.where('827220437', operator, siteCode).get());
        printDocsCount(snapshot, "executeQuery");
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
        printDocsCount(snapshot, "validateBiospecimenUser");
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
        const snapshot = await query.orderBy('role').orderBy('email').get();
        printDocsCount(snapshot, "biospecimenUserList");
        if(snapshot.size !== 0){
            return snapshot.docs.map(document => document.data());
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
        printDocsCount(snapshot, "biospecimenUserExists");
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
        printDocsCount(snapshot, "removeUser");
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

const submitSpecimen = async (biospecimenData, participantData, siteTubesList) => {
    // First update the biospecimenData
    // Under current conditions there will only ever be one specimen per call
    try {
        let participantToken, siteCode;
        // Get the existing participant data (necessary for data reconciliation purposes)
        const participantUid = participantData.state.uid;
        if(!participantUid) {
            throw new Error('Missing participant UID!');
        }
        const {processMouthwashEligibility} = require('./validation');

        await db.runTransaction(async transaction => {
            // @TODO: Honestly we could go through a lot of the helper methods with code overlap
            // and set them up to allow transactions as a parameter
            // in order to be called within a transaction without redundant code

            // Specimen ID is stored in key 820476880 (collectionId)

            // If necessary, update the biospecimenData to have the correct Streck placeholder data
            if (!biospecimenData[fieldMapping.tubesBagsCids.streckTube]) { // Check for streck data due to intermittent null streck values in Firestore (11/2023).
                const { buildStreckPlaceholderData } = require('./shared');
                buildStreckPlaceholderData(biospecimenData[fieldMapping.collectionId], biospecimenData[fieldMapping.tubesBagsCids.streckTube] = {});
            }

            // Basically do equivalent of
            //  const participant = await retrieveUserProfile(uid);
            // const siteCode = participant['827220437'];

            const participantQuery = db.collection('participants')
                .where('state.uid', '==', participantUid);
            const participantSnapshot = await transaction.get(participantQuery);

            if(participantSnapshot.size === 0) {
                throw new Error('Participant with uid ' + participantUid + 'not found.');
            }

            const participantSnapshotData = participantSnapshot.docs[0].data();
            siteCode = participantSnapshotData[fieldMapping.healthCareProvider];
            participantToken = participantSnapshotData['token'];


            // Extremely similar to submit function in submission.js

            // Remove locked attributes.
            const { lockedAttributes } = require('./shared');
            lockedAttributes.forEach(atr => delete participantData[atr]);

            // We should not need to cover the consent form or survey submission  cases here

            // We need to get the token and use it to get the specimen collections and user surveys
            // Get the token via the equivalent of const token = await getTokenForParticipant(uid); but within a transaction

            const specimenCollectionQuery = db.collection('biospecimen')
                .where('token', '==', participantToken)
                .where(fieldMapping.healthCareProvider.toString(), '==', siteCode)
                .where(fieldMapping.collectionId.toString(), '==', biospecimenData[fieldMapping.collectionId]);
            const specimenCollectionSnapshot = await transaction.get(specimenCollectionQuery);
            const specimenArray = specimenCollectionSnapshot.size > 0 ? 
                specimenCollectionSnapshot.docs.map(document => document.data()) :
                [];

            const { buildStreckPlaceholderData, updateBaselineData } = require('./shared');
            let participantUpdates = updateBaselineData(biospecimenData, participantData, participantUid, specimenArray, siteTubesList);

            participantUpdates = { ...participantData, ...participantUpdates};
            // Now run equivalent of updateParticipantData(participantSnapshot.docs[0].id, updates);
            transaction.update(participantSnapshot.docs[0].ref, participantUpdates);
            transaction.update(specimenCollectionSnapshot.docs[0].ref, biospecimenData);
        });
        // After discussion, we have elected to leave checkDerivedVariables as separate logic
        // outside of the transaction for legacy purposes
        const {checkDerivedVariables} = require('./validation');
        await checkDerivedVariables(participantToken, siteCode);
        // Now process mouthwash eligibility
        // This needs the above to run and so is outside of the transaction
        // First get the updated participant data
        const participantSnapshot = await db.collection('participants')
            .where('state.uid', '==', participantUid)
            .get();
        const eligibilityUpdates = processMouthwashEligibility(participantSnapshot.docs[0].data());

        if (eligibilityUpdates && Object.keys(eligibilityUpdates).length) {
            await participantSnapshot.docs[0].ref.update(eligibilityUpdates);
        }

        return {
            code: 200,
            message: 'Success'
        }
    } catch(err) {
        console.error('error', err);
        return {
            code: 500,
            message: err && err.message ? err.message : (err + '')
        }
    }
}

const updateSpecimen = async (id, data) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', id).get();
    printDocsCount(snapshot, "updateSpecimen");
    const docId = snapshot.docs[0].id;

    if (!data[fieldMapping.tubesBagsCids.streckTube]) { // Check for streck data due to intermittent null streck values in Firestore (11/2023).
        const { buildStreckPlaceholderData } = require('./shared');
        buildStreckPlaceholderData(data[fieldMapping.collectionId], data[fieldMapping.tubesBagsCids.streckTube] = {});
    }

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
        printDocsCount(snapshot, "getUnshippedBoxes");
        
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
        printDocsCount(snapshot, "getSpecimensByBoxedStatus");
        
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
        printDocsCount(snapshotResponse, "updateBox");
        
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
    printDocsCount([boxSnapshot, ...specimenSnapshots], "removeBag");

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
    printDocsCount(snapshot, "reportMissingSpecimen");
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

/**
 * Collection ID editing uses the specimen collection doc and the participant doc when an unfinalized collection's tube details are edited.
 * @param {string} collectionId - the collectionId of the specimen to retrieve.
 * @param {string} siteCode - Site code of the site that collected the specimen.
 * @param {boolean} isBPTL - Is this a BPTL call? If yes, don't apply the healthCareProvider filter.
 * @returns {object, object} - the specimenCollection and the attached participant. Used in Biospecimen Collection editing screen from Collection ID search.
 */
const getSpecimenAndParticipant = async (collectionId, siteCode, isBPTL) => {
    try {
        // Fetch the specimen
        let query = db.collection('biospecimen').where(fieldMapping.collectionId.toString(), '==', collectionId);
        if (!isBPTL) query = query.where(fieldMapping.healthCareProvider.toString(), '==', siteCode);
        const snapshot = await query.get();
        printDocsCount(snapshot, "getSpecimenAndParticipant; collection: biospecimen");

        if (snapshot.size !== 1) {
            throw new Error('Couldn\'t find matching specimen document.');
        }
        const specimenData = snapshot.docs[0].data();

        // Use the Connect_ID in the specimen doc to fetch the participant
        const participantSnapshot = await db.collection('participants').where('Connect_ID', '==', specimenData['Connect_ID']).get();
        printDocsCount(participantSnapshot, "getSpecimenAndParticipant; collection: participants");

        if (participantSnapshot.size !== 1) {
            throw new Error('Couldn\'t find matching participant document.');
        }
        const participantData = participantSnapshot.docs[0].data();

        return { specimenData, participantData };
    } catch (error) {
        throw new Error(error, { cause: error });
    }
}

const searchSpecimen = async (masterSpecimenId, siteCode, allSitesFlag) => {
    const snapshot = await db.collection('biospecimen').where('820476880', '==', masterSpecimenId).get();
    printDocsCount(snapshot, "searchSpecimen");
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
        printDocsCount(snapshot, "getSiteLocationBox");
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
 * @returns {array} - array of biospecimen documents
 * Firestore 'in' operator limit with two .where() clauses is 15 (30 with one .where() clause).
*/
const searchSpecimenBySiteAndBoxId = async (requestedSite, boxId) => {
    try {
        const collectionIdArray = await getBiospecimenCollectionIdsFromBox(requestedSite, boxId);

        const chunkSize = 15;
        const collectionIdArrayChunks = createChunkArray(collectionIdArray, chunkSize);
        
        const chunkedPromises = collectionIdArrayChunks.map(chunk => {
            return db.collection('biospecimen')
            .where(fieldMapping.healthCareProvider.toString(), "==", requestedSite)
            .where(fieldMapping.collectionId.toString(), "in", chunk).get();
        });
        
        const promiseResults = await Promise.all(chunkedPromises);
        printDocsCount(promiseResults, "searchSpecimenBySiteAndBoxId");
        
        const biospecimenDocs = [];
        promiseResults.forEach(snapshot => {
            if (!snapshot.empty) {
                snapshot.docs.forEach(doc => biospecimenDocs.push(doc.data()));
            }
        });

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
    printDocsCount(snapshot, "searchShipments");

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
    printDocsCount(snapshot, "specimenExists");
    if(snapshot.size === 1) return true;
    else return false;
}

const boxExists = async (boxId, loginSite) => {
    const snapshot = await db.collection('boxes').where('132929440', '==', boxId).where('789843387', '==', loginSite).get();
    printDocsCount(snapshot, "boxExists");
    if(snapshot.size === 1) return true;
    else return false;
}

const accessionIdExists = async (accessionId, accessionIdType, siteCode) => {
    const snapshot = await db.collection('biospecimen').where(accessionIdType, '==', accessionId).get();
    printDocsCount(snapshot, "accessionIdExists");
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
    printDocsCount(snapshot, "updateTempCheckDate");
    if(snapshot.size === 1) {
        const docId = snapshot.docs[0].id;
        await db.collection('SiteLocations').doc(docId).update({'nextTempMonitor':currDate.toString()});
    }
}

/**
 * 
 * @param {Array<string>} boxIdArray - array of box ids to fetch
 * @param {string} siteCode - site code of the user (number)
 * @param {Transaction} transaction - firestore transation object
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
            printDocsCount(snapshots, "getBoxesByBoxId");

            snapshots.forEach(snapshot => {
                const docsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
                resultsArray.push.apply(resultsArray, docsArray);
            });

        } else {
            const snapshot = await getSnapshot(boxIdArray);
            resultsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
            printDocsCount(snapshot, "getBoxesByBoxId");
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
    printDocsCount(snapshot, "shipBox");
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
    printDocsCount(snapshot, "getLocations");
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
        printDocsCount(snapshot, "searchBoxes");
        return snapshot.docs.map(document => document.data());
    } else {
        return [];
    }
}

const searchBoxesByLocation = async (institute, location) => {
    console.log("institute" + institute);
    console.log("location" + location);
    const snapshot = await db.collection('boxes').where('789843387', '==', institute).where('560975149','==',location).get();
    printDocsCount(snapshot, "searchBoxesByLocation");
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
    printDocsCount(snapshot, "getSpecimenCollections");
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

// TODO: Avoid using `offset` for pagination, because offset documents are still read and charged.
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
        printDocsCount(snapshot, `getBoxesPagination; offset: ${currPage * elementsPerPage}`);
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
        const snapshot = await query.count().get();
        return snapshot.data().count;
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
        printDocsCount(snapshot, "getNotificationSpecifications");
        return snapshot.docs.map(document => {
            return document.data();
        });
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const sendClientEmail = async (data) => {

    const { sendEmail } = require('./notifications');
    const { v4: uuid }  = require('uuid');

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

    await storeNotification(reminder);

    sendEmail(data.email, data.subject, data.message);
    return true;
};

const storeNotification = async (notificationData) => {
    try {
        await db.collection('notifications').add(notificationData);
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

/**
 * 
 * @param {string} userToken User token
 * @param {string} specId Notification Specifications ID
 */
const checkIsNotificationSent = async (userToken, specId) => {
  const snapshot = await db
    .collection("notifications")
    .where("token", "==", userToken)
    .where("notificationSpecificationsID", "==", specId)
    .count()
    .get();

  return snapshot.data().count > 0;
};

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
        const docRef = db.collection("notifications").doc();
        batch.set(docRef, record);
      }

      await batch.commit();
    } catch (error) {
      throw new Error("saveNotificationBatch() error.", {cause: error});
    }
  }
};

const markNotificationAsRead = async (id, collection) => {
    const snapshot = await db.collection(collection).where('id', '==', id).get();
    printDocsCount(snapshot, "markNotificationAsRead");
    const docId = snapshot.docs[0].id;
    await db.collection(collection).doc(docId).update({read: true});
}

const storeSSN = async (data) => {
    try{
        const response = await db.collection('ssn').where('uid', '==', data.uid).get();
        printDocsCount(response, "storeSSN");
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
    printDocsCount(snapshot, "getTokenForParticipant");
    return snapshot.docs[0].data()['token'];
}

const getSiteDetailsWithSignInProvider = async (acronym) => {
    const snapshot = await db.collection('siteDetails').where('acronym', '==', acronym).get();
    printDocsCount(snapshot, "getSiteDetailsWithSignInProvider");
    return snapshot.docs[0].data();
}

const retrieveNotificationSchemaByID = async (id) => {
  const snapshot = await db.collection("notificationSpecifications").where("id", "==", id).get();
  printDocsCount(snapshot, "retrieveNotificationSchemaByID");
  if (snapshot.size === 1) {
    return snapshot.docs[0].id;
  }

  return "";
};

const retrieveNotificationSchemaByCategory = async (category, getDrafts = false) => {
  let query = db.collection("notificationSpecifications").where("isDraft", "==", getDrafts).where("sendType", "==", "scheduled");
  if (category !== "all") {
    query = query.where("category", "==", category);
  } else {
    query = query.orderBy("category");
  }

  const snapshot = await query.orderBy("attempt").get();
  printDocsCount(snapshot, "retrieveNotificationSchemaByCategory");
  return snapshot.docs.map((doc) => doc.data());
};

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
    printDocsCount(participantRecord, "getNotificationHistoryByParticipant; collection: participants");

    if(participantRecord.size === 1) {
        const snapshot = await db.collection('notifications')
                                    .where('token', '==', token)
                                    .orderBy('notification.time', 'desc')
                                    .get();
        printDocsCount(snapshot, "getNotificationHistoryByParticipant; collection: notifications");

        return snapshot.docs.map(dt => dt.data());
    }
    else return false;
}

const getNotificationsCategories = async (scheduleAt) => {
    const snapshot = await db.collection('notificationSpecifications').where('scheduleAt', '==', scheduleAt).get();
    printDocsCount(snapshot, "getNotificationsCategories");
    const categories = [];
    snapshot.forEach(dt => {
        const category = dt.data().category;
        if(!categories.includes(category)) categories.push(category);
    })
    return categories;
}

const getEmailNotifications = async (scheduleAt) => {
    const snapshot = await db.collection('notificationSpecifications').where('scheduleAt', '==', scheduleAt).get();
    printDocsCount(snapshot, "getEmailNotifications");
    const notifications = [];
    snapshot.forEach(dt => {
        const notification = dt.data();
        if(!notifications.includes(notification.id) && notification.notificationType[0] == 'email') notifications.push(notification);
    })
    return notifications;
}

/**
 * Get all notification specifications that are not drafts and match the scheduleAt time. This function can be run multiple times per day, for testing.
 * @param {string} scheduleAt Time of day to send notifications, eg. '15:00'
 * @returns 
 */
const getNotificationSpecsBySchedule = async (scheduleAt) => {
  const snapshot = await db.collection("notificationSpecifications").where("scheduleAt", "==", scheduleAt).get();
  printDocsCount(snapshot, "getNotificationSpecsBySchedule");
  let notificationSpecArray = [];
  for (const doc of snapshot.docs) {
    const docData = doc.data();
    if (!docData.isDraft && docData.id) notificationSpecArray.push(docData);
  }

  return notificationSpecArray;
};

/**
 * Get all notification specifications that are not drafts and match the scheduleAt time. This function is run once per day, for production use.
 * @param {string} scheduleAt Time of day to send notifications, eg. '15:00'
 * @returns 
 */
const getNotificationSpecsByScheduleOncePerDay = async (scheduleAt) => {
  const eastTimezone = { timezone: "America/New_York" };
  const currTime = new Date();
  const currDate = currTime.toLocaleDateString("en-US", eastTimezone);
  const currTimeIsoStr = currTime.toISOString();
  const batch = db.batch();
  const snapshot = await db
    .collection("notificationSpecifications")
    .where("scheduleAt", "==", scheduleAt)
    .where("isDraft", "==", false)
    .get();
  printDocsCount(snapshot, "getNotificationSpecsByScheduleOncePerDay");
  let notificationSpecArray = [];
  for (const doc of snapshot.docs) {
    const docData = doc.data();
    const lastRunTime = docData.lastRunTime || "2020-01-01";
    const lastRunDate = new Date(lastRunTime).toLocaleDateString("en-US", eastTimezone);
    if (docData.id && currDate !== lastRunDate) {
      notificationSpecArray.push(docData);
      batch.update(doc.ref, { lastRunTime: currTimeIsoStr });
    }
  }

  await batch.commit(); // batch limit: 500
  return notificationSpecArray;
};

const getNotificationSpecById = async (id) => {
    const snapshot = await db.collection('notificationSpecifications').where('id', '==', id).get();
    printDocsCount(snapshot, "getNotificationSpecById");

    return snapshot.empty ? null : snapshot.docs[0].data();
}

const getNotificationSpecByCategoryAndAttempt = async (category = "", attempt = "") => {
  if (!category || !attempt) return null;

  const snapshot = await db
    .collection("notificationSpecifications")
    .where("category", "==", category)
    .where("attempt", "==", attempt)
    .get();
  printDocsCount(snapshot, "getNotificationSpecByCategoryAndAttempt");

  return snapshot.empty ? null : snapshot.docs[0].data();
};

const validateKitAssemblyData = (data) => {
    // Ensure that values are uppercase and that the appropriate values match
    if(data[fieldMapping.returnKitId]) {
        data[fieldMapping.returnKitId] = ('' + data[fieldMapping.returnKitId]).toUpperCase();
    }
    if(data[fieldMapping.supplyKitId]) {
        data[fieldMapping.supplyKitId] = ('' + data[fieldMapping.supplyKitId]).toUpperCase();
    }
    if(data[fieldMapping.collectionCupId]) {
        data[fieldMapping.collectionCupId] = ('' + data[fieldMapping.collectionCupId]).toUpperCase();
    }
    if(data[fieldMapping.collectionCardId]) {
        data[fieldMapping.collectionCardId] = ('' + data[fieldMapping.collectionCardId]).toUpperCase();
    }
    if(data[fieldMapping.returnKitId] !== data[fieldMapping.supplyKitId]) {
        throw new Error('Return Kit ID and Supply Kit ID do not match.');
    }
    if(data[fieldMapping.collectionCupId] !== data[fieldMapping.collectionCardId]) {
        throw new Error('Collection Cup ID and Collection Card ID do not match.');
    }
    return data;
}

const addKitAssemblyData = async (data) => {
    try {
        validateKitAssemblyData(data);
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
        validateKitAssemblyData(data);
        const snapshot = await db.collection('kitAssembly').where('687158491', '==', data['687158491']).get();
        printDocsCount(snapshot, "updateKitAssemblyData");

        if (snapshot.empty) return false
        const docId = snapshot.docs[0].id;
 
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

const checkCollectionUniqueness = async (supplyId, collectionId, returnKitTrackingNumber) => {
    try {
        const supplySnapShot = await db.collection('kitAssembly').where('690210658', '==', supplyId).get();
        const collectionSnapShot = await db.collection('kitAssembly').where('259846815', '==', collectionId).get();
        printDocsCount([supplySnapShot, collectionSnapShot], "checkCollectionUniqueness");
        let returnKitTrackingNumberSnapshot = {docs: []};
        let supplyKitTrackingNumberSnapshot = {docs: []};
        if(returnKitTrackingNumber) {
            [returnKitTrackingNumberSnapshot, supplyKitTrackingNumberSnapshot] = await Promise.all([
                db.collection('kitAssembly').where(fieldMapping.returnKitTrackingNum.toString(), '==', returnKitTrackingNumber).get(),
                db.collection('kitAssembly').where(fieldMapping.supplyKitTrackingNum.toString(), '==', returnKitTrackingNumber).get()
            ]);
        }
        if (supplySnapShot.docs.length === 0 && collectionSnapShot.docs.length === 0
            && returnKitTrackingNumberSnapshot.docs.length === 0 && supplyKitTrackingNumberSnapshot.docs.length === 0) {
            return true;
        } else if (supplySnapShot.docs.length !== 0) {
            return 'duplicate supplykit id';
        } else if (collectionSnapShot.docs.length !== 0) {
            return 'duplicate collection id';
        } else if (returnKitTrackingNumberSnapshot.docs.length !== 0) {
            return 'duplicate return kit tracking number';
        } else if (supplyKitTrackingNumberSnapshot.docs.length !== 0) {
            return 'return kit tracking number is for supply kit';
        }
    } catch (error) {
        return new Error(error);
    }
};

const participantHomeCollectionKitFields = [
    fieldMapping.collectionDetails.toString(),
    fieldMapping.firstName.toString(),
    fieldMapping.lastName.toString(),
    fieldMapping.address1.toString(),
    fieldMapping.address2.toString(),
    fieldMapping.city.toString(),
    fieldMapping.state.toString(),
    fieldMapping.zip.toString(),
    'Connect_ID',
];

/**
 * Creates new array based on query below.
 * Each participant object is transformed into a new object or an empty array.
 * @returns {Array} - Array of object(s) and/or array(s) based on processParticipantData function.
 * Ex. [{first_name: 'John', last_name: 'Doe', address_1: '123 Main St', address_2: '', city: 'Anytown', state: 'NY', zip_code: '12345', connect_id: 123457890}, ...]
 */


// TODO: A sliding time window would be more efficient in the .where(<timestamp>) query.

const queryHomeCollectionAddressesToPrint = async (limit) => {
    try {
        const { bioKitMouthwash, kitStatus, initialized,
            collectionDetails, baseline, bloodOrUrineCollectedTimestamp } = fieldMapping;

        const fiveDaysAgoDateISO = getFiveDaysAgoDateISO();

        let query = db.collection('participants')
            .where(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${kitStatus}`, '==', initialized)
            .where(`${collectionDetails}.${baseline}.${bloodOrUrineCollectedTimestamp}`, '<=', fiveDaysAgoDateISO)
            .orderBy(`${collectionDetails}.${baseline}.${bloodOrUrineCollectedTimestamp}`, 'desc');

        if(limit) {
            query = query.limit(Math.min(limit, 500));
        }

        const snapshot = await query.get();

        if (snapshot.size === 0) return [];


        const mappedResults = snapshot.docs.map(doc => processParticipantHomeMouthwashKitData(doc.data(), true));
        return mappedResults.filter(result => result !== null);
    } catch (error) {
        throw new Error(`Error querying home collection addresses to print`, {cause: error});
    }
}

const queryCountHomeCollectionAddressesToPrint = async () => {
    try {
        const { bioKitMouthwash, kitStatus, initialized,
            collectionDetails, baseline, bloodOrUrineCollectedTimestamp } = fieldMapping;
        const fiveDaysAgoDateISO = getFiveDaysAgoDateISO();

        const snapshot = await db.collection('participants')
            .where(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${kitStatus}`, '==', initialized)
            .where(`${collectionDetails}.${baseline}.${bloodOrUrineCollectedTimestamp}`, '<=', fiveDaysAgoDateISO)
            .count()
            .get();

        return snapshot.data().count;

    } catch (error) {
        throw new Error(`Error querying count of home collection addresses to print`, {cause: error});
    }
};

const queryKitsByReceivedDate = async (receivedDateTimestamp) => {
    try {
        const snapShot = await db.collection('biospecimen').where('143615646.826941471', '==', receivedDateTimestamp).get();
        return snapShot.docs.map(document => document.data());
    } catch (error) {
        return new Error(error);
    }
}

const eligibleParticipantsForKitAssignment = async () => {
    try {
        const { addressPrinted, collectionDetails, baseline, bioKitMouthwash, bloodOrUrineCollectedTimestamp, kitStatus } = fieldMapping;

        const snapshot = await db.collection("participants")
            .where(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${kitStatus}`, '==', addressPrinted)
            .select(...participantHomeCollectionKitFields)
            .orderBy(`${collectionDetails}.${baseline}.${bloodOrUrineCollectedTimestamp}`, 'desc')
            .get();
        printDocsCount(snapshot, "eligibleParticipantsForKitAssignment");

        if (snapshot.size === 0) return [];
        const mappedResults = snapshot.docs.map(doc => processParticipantHomeMouthwashKitData(doc.data(), false));
        return mappedResults.filter(result => result !== null);

    } catch(error) {
        throw new Error('Error getting Eligible Kit Assignment Participants.', {cause: error});
    }
}

const addKitStatusToParticipant = async (participantsCID) => {
    try {
        const { collectionDetails, baseline, bioKitMouthwash, kitStatus, addressPrinted } = fieldMapping;

        // Create an array of promises to update participants in parallel
        const updatePromises = participantsCID.map(async (participantCID) => {
            const snapshot = await db.collection("participants").where('Connect_ID', '==', parseInt(participantCID)).get();
            printDocsCount(snapshot, "addKitStatusToParticipant");
            if (snapshot.size === 0) {
                // No matching document found, stop the update
                return false;
            }
            const docId = snapshot.docs[0].id;
            const prevParticipantObject = snapshot.docs[0].data()?.[collectionDetails]?.[baseline];
            await db.collection("participants").doc(docId).update({
                [collectionDetails]: {
                    [baseline]: {
                        ...prevParticipantObject,
                        [bioKitMouthwash]: {
                            [kitStatus]: addressPrinted
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

// Note: existing snake_casing follows through to BPTL CSV reporting. Do not update to camelCase without prior communication.
const processParticipantHomeMouthwashKitData = (record, printLabel) => {
    const { collectionDetails, baseline, bioKitMouthwash, firstName, lastName, address1, address2, city, state, zip } = fieldMapping;

    const addressLineOne = record?.[address1];
    const poBoxRegex = /^(?:P\.?O\.?\s*(?:Box|B\.?)?|Post\s+Office\s+(?:Box|B\.?)?)\s*(\s*#?\s*\d*)((?:\s+(.+))?$)$/i;

    const isPOBoxMatch = poBoxRegex.test(addressLineOne);
    
    if (isPOBoxMatch) return null;

    const hasMouthwash = record[collectionDetails][baseline][bioKitMouthwash] !== undefined;    
    const processedRecord = {
    first_name: record[firstName],
    last_name: record[lastName],
    address_1: record[address1],
    address_2: record[address2] || '',
    city: record[city],
    state: record[state],
    zip_code: record[zip], 
    connect_id: record['Connect_ID'],
    };

    return printLabel || hasMouthwash
        ? processedRecord
        : [];
}

const assignKitToParticipant = async (data) => {
    let kitAssignmentResult;
    const { supplyKitId, kitStatus, uniqueKitID, supplyKitTrackingNum, returnKitTrackingNum,
        assigned, collectionRound, collectionDetails, baseline, bioKitMouthwash, 
        kitType, mouthwashKit } = fieldMapping;

    await db.runTransaction(async (transaction) => {
        // Check the supply kit tracking number and see if it matches the return kit tracking number
        // of any kits including this one or the supply kit tracking number of any other kits

        const kitsWithDuplicateReturnTrackingNumbers = await transaction.get(
            db.collection("kitAssembly").where(`${returnKitTrackingNum}`, '==', data[supplyKitTrackingNum])
        );

        if(kitsWithDuplicateReturnTrackingNumbers.size > 0) {
            kitAssignmentResult = {
                success: false,
                message: "Duplicate return tracking number found: " + data[supplyKitTrackingNum]
            };
            return;
        }

        const otherKitsUsingSupplyKitTrackingNumber = await transaction.get(
            db.collection("kitAssembly")
            .where(`${supplyKitTrackingNum}`, '==', data[supplyKitTrackingNum])
        );

        if(otherKitsUsingSupplyKitTrackingNumber.size > 1) {
            kitAssignmentResult = {
                success: false,
                message: "Other kits using supply kit tracking number found: " + otherKitsUsingSupplyKitTrackingNumber.map(rec => rec.data()[supplyKitId]).join(', ')
            };
                return;
        } else if (otherKitsUsingSupplyKitTrackingNumber.size === 1) {
            // check if the kit found is the current kit
            // Doing this instead of including it in the query to avoid creating an unnecessary composite index
            const possibleDuplicate = otherKitsUsingSupplyKitTrackingNumber.docs[0];
            const possibleDuplicateKitId = possibleDuplicate.data()[supplyKitId];
            if(possibleDuplicateKitId !== data[supplyKitId]) {
                kitAssignmentResult = {
                    success: false,
                    message: "Other kit using supply kit tracking number found: " + possibleDuplicateKitId
                };
                return;
            }
        }

        const kitSnapshot = await transaction.get(
            db.collection("kitAssembly")
                .where(`${supplyKitId}`, '==', data[supplyKitId])
        );
        printDocsCount(kitSnapshot, "assignKitToParticipant; collection: kitAssembly");

        if (kitSnapshot.size > 1) {
            kitAssignmentResult = {
                success: false,
                message: "Multiple pending kits found for supply kit ID " + data[supplyKitId]
            };
            return;
        }

        if(kitSnapshot.size === 0) {
            kitAssignmentResult = {
                success: false,
                message: "Kit not found for supply kit ID " + data[supplyKitId]
            };
            return;
        }

        const kitDoc = kitSnapshot.docs[0];
        data[uniqueKitID] = kitDoc.data()[uniqueKitID];
        const kitData = {
            [supplyKitTrackingNum]: data[supplyKitTrackingNum],
            [kitStatus]: assigned,
            [collectionRound]: baseline,
            'Connect_ID': parseInt(data['Connect_ID'])
        };


        const participantSnapshot = await transaction.get(
            db.collection("participants")
                .where('Connect_ID', '==', parseInt(data['Connect_ID']))
        );
        printDocsCount(participantSnapshot, "assignKitToParticipant; collection: participants");

        // 1109: Check if the participant already has another baseline kit assigned and error if it does.
        // Note that this will need to be modified in the future to recognize and handle replacement kits
        // once that functionality is added
        const kitAssemblyQuery =  db.collection("kitAssembly")
            .where('Connect_ID', '==', parseInt(data['Connect_ID']))
            .where(`${kitStatus}`, '==', assigned)
            .where(`${collectionRound}`, '==', baseline)
            // .select([`${supplyKitId}`]);
        const kitAssemblySnapshot = await transaction.get(kitAssemblyQuery);

        printDocsCount(participantSnapshot, "assignKitToParticipant; collection: possible duplicate kits");


        if(kitAssemblySnapshot.size > 0) {
            // Check to see if there are any baseline kits which are already assigned but with a different kit ID
            // If so, error
            const duplicateKit = kitAssemblySnapshot.docs.find(doc => {
                const docData = doc.data();
                return docData[supplyKitId] !== data[supplyKitId];
            });
            if(duplicateKit) {
                // A kit has already been assigned; terminate without updates.
                let errorMsg = `Duplicate kit ${duplicateKit.data()[supplyKitId]} found when attempting to assign kit ${data[supplyKitId]} to user ${data['Connect_ID']}`;
                console.error(errorMsg);
                kitAssignmentResult = {
                    success: false,
                    message: errorMsg
                };
                return;
            }
        }

        if (participantSnapshot.size !== 1) {
            kitAssignmentResult = {
                success: false,
                message: (participantSnapshot.size > 1 ? 'Multiple' : 'No') + ' participants found for connect ID ' + data['Connect_ID']
            };
            return;
        }

        const participantDoc = participantSnapshot.docs[0];
        const prevParticipantObject = participantDoc.data()?.[collectionDetails]?.[baseline];
        
        const updatedParticipantObject = {
            [collectionDetails]: {
                [baseline]: {
                    ...prevParticipantObject,
                    [bioKitMouthwash]: {
                        [kitType]: mouthwashKit,
                        [kitStatus]: assigned,
                        [uniqueKitID]: data[uniqueKitID],
                    }
                }
            }
        };

        transaction.update(kitDoc.ref, kitData);
        transaction.update(participantDoc.ref, updatedParticipantObject);

        kitAssignmentResult = {
            success: true,
            message: 'Success'
        };
        return true;
    });
    
    return kitAssignmentResult;
};




const processVerifyScannedCode = async (id) => {
    try {
        const snapshot = await db.collection('kitAssembly').where('531858099', '==', id).where('221592017', '==', 241974920).get();
        printDocsCount(snapshot, "processVerifyScannedCode");
        if (snapshot.docs.length === 1) {
            return { valid: true, uniqueKitID: snapshot.docs[0].data()[687158491] }
        }
        else { return false }
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const confirmShipmentKit = async (shipmentData) => {
    try {
        return await db.runTransaction(async transaction => {
            const { collectionDetails, baseline, bioKitMouthwash, uniqueKitID } = fieldMapping;

            const kitAssemblyQuery = db.collection("kitAssembly").where('687158491', '==', shipmentData['687158491']);
            const kitSnapshot = await transaction.get(kitAssemblyQuery);
            printDocsCount(kitSnapshot, "confirmShipmentKit; collection: kitAssembly");

            if (kitSnapshot.size === 0) {
                return false;
            }

            const kitDoc = kitSnapshot.docs[0];
            const kitData = {
                '221592017': 277438316,
                '661940160': shipmentData['661940160']
            };

            
            const participantQuery = db.collection("participants")
                .where(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${uniqueKitID}`, '==', shipmentData[uniqueKitID]);
            const participantSnapshot = await transaction.get(participantQuery);
            printDocsCount(participantSnapshot, "confirmShipmentKit; collection: participants");

            if (participantSnapshot.size === 0) {
                return false;
            }

            const participantDoc = participantSnapshot.docs[0];
            const participantDocData = participantDoc.data();
            const prevParticipantObject = participantDocData[collectionDetails][baseline][bioKitMouthwash];
            const baselineParticipantObject = participantDocData[173836415][266600170];
            const uid = participantDocData['state']['uid'];
            const Connect_ID = participantDocData['Connect_ID'];
            const prefEmail = participantDocData['869588347'];
            const token = participantDocData['token'];
            const ptName = participantDocData['153211406'] || participantDocData['399159511']
            const preferredLanguage = cidToLangMapper[participantDocData[fieldMapping.preferredLanguage]] || cidToLangMapper[fieldMapping.english];

            const updatedParticipantObject = {
                '173836415': {
                    '266600170': {
                        ...baselineParticipantObject,
                        '319972665': {
                            ...prevParticipantObject,
                            '221592017': 277438316,
                            '661940160': shipmentData['661940160']
                        }
                    }
                }
            };

            transaction.update(kitDoc.ref, kitData);
            transaction.update(participantDoc.ref, updatedParticipantObject);
            return { status: true, Connect_ID, token, uid, prefEmail, ptName, preferredLanguage };
        });
        

    } catch (error) {
        console.error(error);
        return new Error(error);
    }
};

const storeKitReceipt = async (pkg) => {
    try {
        let toReturn;
        await db.runTransaction(async (transaction) => {
            const kitSnapshot = await transaction.get(db.collection("kitAssembly").where('972453354', '==', pkg['972453354']).where('221592017', '==', 277438316));
            printDocsCount(kitSnapshot, "storeKitReceipt");
            if (kitSnapshot.size === 0) {
                toReturn = false;
                return;
            }
            const kitDoc = kitSnapshot.docs[0];
            const kitData = kitDoc.data();
            const Connect_ID = kitData['Connect_ID'];
    
            const participantSnapshot = await transaction.get(db.collection("participants").where('173836415.266600170.319972665.687158491', '==', kitDoc.data()[687158491]));
            const participantDoc = participantSnapshot.docs[0];
            const participantDocData = participantSnapshot.docs[0].data();

            const token = participantDocData['token'];
            const uid = participantDocData['state']['uid'];
            const site = participantDocData['827220437'];
            const prefEmail = participantDocData['869588347'];
            const ptName = participantDocData['153211406'] || participantDocData['399159511']
            const surveyStatus = participantDocData['547363263']
            const preferredLanguage = cidToLangMapper[participantDocData[fieldMapping.preferredLanguage]] || cidToLangMapper[fieldMapping.english];

            const prevParticipantObject = participantDocData[173836415][266600170][319972665];
            const collectionId = pkg['259846815']?.split(' ')[0];
            const objectId = pkg['259846815']?.split(' ')[1];
            
            if (objectId === undefined || collectionId === undefined) {
                toReturn = { status: 'Check Collection ID' };
                return;
            }

            // check the collection ID from the kitAssembly against the one from package and error if they don't match
            if(kitData[fieldMapping.collectionCupId] !== pkg[fieldMapping.collectionCupId]) {
                toReturn = { status: 'Collection Cup ID from tracking number does not match provided Collection Cup ID' };
                return;
            }

            const biospecPkg = {
                '143615646': {
                    '593843561': 353358909,
                    '825582494': pkg['259846815'],
                    '826941471': pkg['826941471']
                },
                '260133861': pkg['260133861'],
                '678166505': pkg['678166505'],
                '820476880':  collectionId,
                '827220437': site,
                'Connect_ID': Connect_ID,
                'token': token,
                'uid': uid
            }

            // Create a reference to a document that doesn't exist yet with the given ID
            const newDocRef = db.collection('biospecimen').doc(uid);
            
            transaction.set(newDocRef, biospecPkg);

            transaction.update(kitDoc.ref, {
                '137401245': pkg['137401245'] === true ? 353358909 : 104430631,
                '221592017': 375535639,
                '633640710': processPackageConditions(pkg['633640710']),
                '755095663': pkg['755095663'],
                '826941471': pkg['826941471']
            });

            transaction.update(participantDoc.ref, {
                '684635302': 353358909,
                '254109640': 353358909,
                '173836415.266600170.915179629': 103209024,
                '173836415.266600170.448660695': pkg['678166505'],
                '173836415.266600170.319972665': {
                    ...prevParticipantObject,
                    '221592017': 375535639,
                    '826941471': pkg['826941471']
                }
            });

            toReturn = {
              status: true,
              Connect_ID,
              token,
              uid,
              prefEmail,
              ptName,
              surveyStatus,
              preferredLanguage,
              [fieldMapping.signInMechanism]: participantDocData[fieldMapping.signInMechanism],
              [fieldMapping.authenticationPhone]: participantDocData[fieldMapping.authenticationPhone],
              [fieldMapping.authenticationEmail]: participantDocData[fieldMapping.authenticationEmail],
            };
            return;
        });

        return toReturn;

    } 
    catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const processPackageConditions = (pkgConditions) => {
    const keys = [950521660, 545319575, 938338155, 205954477, 289239334, 992420392, 541085383, 427719697, 100618603];
    const result = {};
    
    for (const key of keys) {
        result[key] = pkgConditions.includes(String(key)) ? 353358909 : 104430631;
    }

    return result;
}

const getKitAssemblyData = async () => {
    try {
        const snapshot = await db.collection("kitAssembly").get();
        printDocsCount(snapshot, "getKitAssemblyData");
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
        printDocsCount(snapshot, "getCoordinatingCenterEmail");
        if(snapshot.size > 0) return snapshot.docs[0].data().email;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getSiteEmail = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        printDocsCount(snapshot, "getSiteEmail");
        if(snapshot.size > 0) return snapshot.docs[0].data().email;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getSiteAcronym = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        printDocsCount(snapshot, "getSiteAcronym");
        if(snapshot.size > 0) return snapshot.docs[0].data().acronym;
    } catch (error) {
        console.error(error);
        return new Error(error);
    }
}

const getSiteMostRecentBoxId = async (siteCode) => {
    try {
        const snapshot = await db.collection('siteDetails').where('siteCode', '==', siteCode).get();
        printDocsCount(snapshot, "getSiteMostRecentBoxId");
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
        const { v4: uuid } = require('uuid');
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

/**
 * Returns an array of custom objects based on the participants biomouthwash kit status
 * @param {string} statusType - concept id of the kit status's type 
 * @returns {Array} - Array of object(s) and/or array(s) based on processParticipantData statusType.
*/
const getParticipantsByKitStatus = async (statusType) => {
    try {
        if (statusType === fieldMapping.shipped.toString()) { // For now this will be the only status enabled for this function, more status types to be added later
            return await shippedKitStatusParticipants();
        }
        return [];
    } catch (error){
        console.error(`Error in getParticipantsByKitStatus:`, error);
        throw new Error("getParticipantsByKitStatus", error);
    }
}


const shippedKitStatusParticipants = async () => { 
    try {
        const { collectionDetails, baseline, bioKitMouthwash, kitStatus, 
                shipped, healthCareProvider, mouthwashSurveyCompletionStatus, shippedDateTime} = fieldMapping;
        
        const snapshot = await db.collection("participants")
                            .where(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${kitStatus}`, '==', shipped)
                            .orderBy(`${collectionDetails}.${baseline}.${bioKitMouthwash}.${shippedDateTime}`, 'asc')
                            .select('Connect_ID', 
                                `${healthCareProvider}`, 
                                `${collectionDetails}`, 
                                `${mouthwashSurveyCompletionStatus}`)
                            .get();
        
        if (!snapshot.empty) {
            const participants = [];
            const kitAssemblyPromises = [];
            const { supplyKitId, supplyKitTrackingNum, returnKitId, collectionCardId, returnKitTrackingNum } = fieldMapping;

            for (const docs of snapshot.docs) {
                const data = docs.data();
                const participantConnectID = data['Connect_ID'];
        
                participants.push({
                    "Connect_ID": participantConnectID,
                    [healthCareProvider]: data[healthCareProvider],
                    [shippedDateTime]: data[collectionDetails]?.[baseline]?.[bioKitMouthwash]?.[shippedDateTime] || '',
                    [mouthwashSurveyCompletionStatus]: data[mouthwashSurveyCompletionStatus],
                });
                
                kitAssemblyPromises.push(
                    db.collection("kitAssembly")
                        .where('Connect_ID', '==', participantConnectID)
                        .select(`${supplyKitId}`, `${supplyKitTrackingNum}`, `${returnKitTrackingNum}`, `${returnKitId}`, `${collectionCardId}`)
                        .get()
                );
            }

            const kitAssemblySnapshots = await Promise.all(kitAssemblyPromises);
            printDocsCount(kitAssemblySnapshots, "shippedKitStatusParticipants");

            kitAssemblySnapshots.forEach((snapshot, index) => {
                if(!snapshot.empty) {
                    const kitData = snapshot.docs[0].data();
                    Object.assign(participants[index], kitData);
                }
            });
            return participants;
        }
    } catch (error) {
        console.error(error);
        throw new Error("Error in shippedKitStatusParticipants. ", error);
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
    try {
        if (data.scannedBarcode.length === 12 || data.scannedBarcode.length === 34) return await setPackageReceiptFedex(data); 
        else return await setPackageReceiptUSPS(data);
    } catch (error) {
        console.error(`Error in the package receipt process: ${error.message}`, { cause: error });
        throw error;
    }
} 


const setPackageReceiptUSPS = async (data) => {
    try {
        const snapshot = await db.collection("participantSelection").where('usps_trackingNum', '==', data.scannedBarcode).get();
        printDocsCount(snapshot, "setPackageReceiptUSPS");
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

const setPackageReceiptFedex = async (boxUpdateData) => {
    try {
        const { bagConceptIDs, validIso8601Format } = require('./shared');        
        let trackingNumber = boxUpdateData.scannedBarcode;
        if (trackingNumber.length === 34) trackingNumber = trackingNumber.slice(12);

        // Find related box using the tracking number. The shipmentTimestamp field is generated for the request when duplicate tracking numners are found.
        let query = db.collection("boxes").where(fieldMapping.boxTrackingNumberScan.toString(), '==', trackingNumber);
        if (boxUpdateData['shipmentTimestamp']) {
            query = query.where(fieldMapping.submitShipmentTimestamp.toString(), '==', boxUpdateData['shipmentTimestamp']);
            delete boxUpdateData['shipmentTimestamp'];
        }
        
        const snapshot = await query.get();
        printDocsCount(snapshot, "setPackageReceiptFedex");
        
        if (snapshot.empty) {
            console.error('Box not found');
            return { message: 'Box Not Found', data: null };
        }

        const boxListData = snapshot.docs.map(doc => ({
            boxDocRef: doc.ref,
            boxData: doc.data(),
        }));

        // If multiple boxes found, return list and trigger selection modal in BPTL dashboard.
        // This has happened in production when a site used the same tracking number twice by mistake. Fedex also reuses tracking numbers.
        if (boxListData.length > 1) {
            return { message: 'Multiple Results', data: boxListData };
        }

        // Beyond this point, we only have one box to handle.
        const boxDocRef = boxListData[0].boxDocRef;
        const boxData = boxListData[0].boxData;

        // snapshotReceivedTimestamp should be null. If not null, box has already been received.
        // Handle box already received and forceWriteOverride property. This has happened by mistake in production.
        const snapshotReceivedTimestamp = boxData[fieldMapping.shipmentReceivedTimestamp];
        if (snapshotReceivedTimestamp && validIso8601Format.test(snapshotReceivedTimestamp)) {
            if (boxUpdateData['forceWriteOverride'] !== true) {
                console.error('Box already received', boxData[fieldMapping.shippingBoxId], snapshotReceivedTimestamp);
                return { message: 'Box Already Received', data: boxData };
            }
        }

        boxUpdateData[fieldMapping.boxTrackingNumberScan] = trackingNumber;
        delete boxUpdateData.scannedBarcode;

        let collectionIdHolder = {};
        const bagKeysInBox = Object.keys(boxData).filter(key => bagConceptIDs.includes(key));
        for (const bag of bagKeysInBox) {
            const bagId = boxData[bag][fieldMapping.tubesBagsCids.biohazardBagScan] || boxData[bag][fieldMapping.tubesBagsCids.biohazardMouthwashBagScan] || boxData[bag][fieldMapping.tubesBagsCids.orphanScan];
            if (bagId){
                const collectionId = bagId.split(' ')[0];
                if (collectionId) {
                    if (!collectionIdHolder[collectionId]) {
                        collectionIdHolder[collectionId] = [];
                    }
                    collectionIdHolder[collectionId] = collectionIdHolder[collectionId].concat(boxData[bag][fieldMapping.samplesWithinBag]);
                }
            }
        }
        await processReceiptData(collectionIdHolder, boxUpdateData, boxDocRef);
        return ({message: 'Success!', data: null});
    } catch(error){
        throw new Error(`setPackageReceiptFedex error. ${error.message}`, { cause: error });
    }
}

const processReceiptData = async (collectionIdHolder, boxUpdateData, boxDocRef) => {
    const miscTubeIdSet = new Set(['0050', '0051', '0052', '0053', '0054']);
    try {
        const specimenDocsToFetch = Object.keys(collectionIdHolder).map(key => {
            return db.collection("biospecimen").where(fieldMapping.collectionId.toString(), '==', key).get();
        });

        const specimenQuerySnapshots = await Promise.all(specimenDocsToFetch);
        printDocsCount(specimenQuerySnapshots, "processReceiptData");
        let specimenDocs = [];
        specimenQuerySnapshots.forEach(snapshot => {
            snapshot.docs.forEach(specimenDoc => {
                specimenDocs.push({
                    ref: specimenDoc.ref,
                    data: specimenDoc.data()
                });
            });
        });

        let batch = db.batch();
        const receivedTimestamp = boxUpdateData[fieldMapping.shipmentReceivedTimestamp];

        for (const key in collectionIdHolder) {
            const specimenDoc = specimenDocs.find(specimenDoc => specimenDoc.data[fieldMapping.collectionId] === key);
            const specimenDocRef = specimenDoc.ref;
            const specimenData = specimenDoc.data;

            let updateObject = {};

            // only update the specimen level received timestamp if it is not already set. Important so stray tubes don't update the specimen level received timestamp.
            if (!specimenData[fieldMapping.shipmentReceivedTimestamp]) {
                updateObject[fieldMapping.shipmentReceivedTimestamp] = receivedTimestamp;
            }

            // Map tube ids to concept ids. If misc tube (0050-0054), find tube's location in specimen to get the concept id.
            for (const element of collectionIdHolder[key]) {
                const tubeId = element.split(' ')[1];

                let tubeConceptId = collectionIdConversion[tubeId]; 
                if (miscTubeIdSet.has(tubeId)) {
                    tubeConceptId = Object.keys(specimenData).find(tubeKey => tubeConceptIds.includes(tubeKey) && specimenData[tubeKey][fieldMapping.objectId] === element);
                }

                if (!tubeConceptId) {
                    console.error('tube concept ID not found for', element);
                } else {
                    const conceptIdTubes = `${tubeConceptId}.926457119`;
                    updateObject[conceptIdTubes] = receivedTimestamp;
                }
            }
            
            batch.update(specimenDocRef, updateObject);
        }

        batch.update(boxDocRef, boxUpdateData);
        await batch.commit();
    } catch(error){
        console.error('processReceiptData error:', error);
        throw new Error(`processReceiptData error: ${error.message}`, { cause: error });
    }
}

const kitStatusCounterVariation = async (currentkitStatus, prevKitStatus) => {
    try {
        await db.collection("bptlMetrics").doc('--metrics--').update({ 
            [currentkitStatus]: admin.firestore.FieldValue.increment(1)
        })
        await db.collection("bptlMetrics").doc('--metrics--').update({ 
            [prevKitStatus]: admin.firestore.FieldValue.increment(-1)
        })
            return true;
    }

    catch (error) {
        return new Error(error);
    }
};

const getBptlMetrics = async () => {
    const snapshot = await db.collection("bptlMetrics").get();
    printDocsCount(snapshot, "getBptlMetrics");
    return snapshot.docs.map(doc => doc.data())
}

const getBptlMetricsForShipped = async () => {
    try {
        let response = []
        const snapshot = await db.collection("participantSelection").where('kit_status', '==', 'shipped').get();
        printDocsCount(snapshot, "getBptlMetricsForShipped");
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
        printDocsCount(snapshot, "queryDailyReportParticipants");
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
        printDocsCount(secondSnapshot, "processQueryDailyReportParticipants");
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
    printDocsCount(snapshot, "getRestrictedFields");
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
    printDocsCount(snapshot, "getBoxesByReceivedDate");
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
        printDocsCount(snapshots, "getSpecimensByCollectionIds");

        snapshots.forEach(snapshot => {
            const docsArray = snapshot.docs.map(document => ({ data: document.data(), docRef: document.ref }));
            resultsArray.push.apply(resultsArray, docsArray);
        });

        return resultsArray;

    } catch (error) {
        throw new Error("Error fetching specimens by collectionIds.", { cause: error });
    }
}

const processSendGridEvent = async (event) => {
    if (!event.notification_id || event.gcloud_project !== process.env.GCLOUD_PROJECT) return;

    const date = new Date(event.timestamp * 1000).toISOString();
    const snapshot = await db
        .collection("notifications")
        .where("id", "==", event.notification_id)
        .get();
    printDocsCount(snapshot, "processSendGridEvent");

    if (snapshot.size > 0) {
        const doc = snapshot.docs[0];
        const eventRecord = {
            [`${event.event}Status`]: true,
            [`${event.event}Date`]: date,
        };
        if (["bounce", "dropped"].includes(event.event)) {
            eventRecord[`${event.event}Reason`] = event.reason;
        }
        await db.collection("notifications").doc(doc.id).update(eventRecord);
    } else {
        console.error(`Could not find notifications ${event.notification_id}. Status ${event.event}`)
    }
};

const processTwilioEvent = async (event) => {
    if (!["failed", "delivered", "undelivered"].includes(event.MessageStatus)) return 
    const date = new Date().toISOString();

    const snapshot = await db
        .collection("notifications")
        .where("messageSid", "==", event.MessageSid)
        .get();
    printDocsCount(snapshot, "processTwilioEvent");

    if (snapshot.size > 0) {
        const doc = snapshot.docs[0];
        const eventRecord = {
            status: event.MessageStatus,
            [`${event.MessageStatus}Date`]: date,
            errorCode: event.ErrorCode || "",
            errorMessage: event.ErrorMessage || twilioErrorMessages[event.ErrorCode] || "",
        };

        await db.collection("notifications").doc(doc.id).update(eventRecord);

        if (event.ErrorCode === "21610") {
            await updateSmsPermission(doc.data().phone, false);
        }

    } else {
        console.error(`Could not find messageSid ${event.MessageSid}. Status ${event.MessageStatus}`)
    }
};

const getParticipantCancerOccurrences = async (participantToken) => {
    try {
        const snapshot = await db.collection('cancerOccurrence').where('token', '==', participantToken).get();
        printDocsCount(snapshot, "getParticipantCancerOccurrences");
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        throw new Error("Error fetching cancer occurrences.", { cause: error });
    }
}

/**
 * Write cancer occurrence object data to Firestore. 
 * @param {array<object>} cancerOccurrenceArray - Array of cancer occurrence objects.
 */

const writeCancerOccurrences = async (cancerOccurrenceArray) => {
    const writeCancerOccurrenceBatch = async () => {
        const batch = db.batch();
        for (const occurrence of cancerOccurrenceArray) {
            const docRef = db.collection('cancerOccurrence').doc();
            batch.set(docRef, occurrence);
        }
        await batch.commit();
    };

    try {
        await firestoreWriteWithAutoRetry(writeCancerOccurrenceBatch, 'writeCancerOccurrences');
    } catch (error) {
        console.error('Error in writeCancerOccurrences:', error);
        throw new Error(`Write Cancer Occurrences failed: ${error.message}`);
    }
};

/**
 * Occasionally, birthday card data needs to be updated based on return data from the post office.
 * Check for duplicate birthday card data before writing to Firestore.
 * An existing birthday card is one with the same token, mailDate, and cardVersion.
 * @param {string} participantToken - The participant token.
 * @param {string} mailingDate - ISO 8601 date string.
 * @param {string} cardVersion - The version of the birthday card.
 * @returns {object} - The existing birthday card data and Firestore document ID.
 */
const getExistingBirthdayCard = async (participantToken, mailingDate, cardVersion) => {
    try {
        const snapshot = await db.collection('birthdayCard')
            .where('token', '==', participantToken)
            .where(fieldMapping.birthdayCardData.mailDate.toString(), '==', mailingDate)
            .where(fieldMapping.birthdayCardData.cardVersion.toString(), '==', cardVersion)
            .get();

        if (snapshot.empty) {
            return { existingCardData: null, cardDocId: null };
        }
        
        if (snapshot.size > 1) {
            console.error(`Duplicate birthday card data found for token ${participantToken} and mailing date ${mailingDate}.`);
        }
        
        return { existingCardData: snapshot.docs[0].data(), cardDocId: snapshot.docs[0].id };
    } catch (error) {
        console.error('Error in getExistingBirthdayCard:', error);
        throw new Error("Error fetching birthday card data.", { cause: error });
    }
}

/**
 * Write the NORC birthday card data to Firestore.
 * @param {object} birthdayCardData - The NORC birthday card data.
 * @param {object} birthdayCardWriteDetails - Object with .cardWriteType (either 'create' or 'update') and .docId (only provided for update operations) properties.
 */

const writeBirthdayCard = async (birthdayCardData, birthdayCardWriteDetails) => {
    try {
        const writeCard = async () => {
            const { cardWriteType, cardDocId } = birthdayCardWriteDetails;

            if (cardWriteType === 'create') {
                await db.collection('birthdayCard').add(birthdayCardData);
            } else if (cardWriteType === 'update') {
                if (!cardDocId) {
                    throw new Error('Document ID is required for update operation.');
                }
                await db.collection('birthdayCard').doc(cardDocId).update(birthdayCardData);
            } else {
                console.error(`Invalid birthday card write type: ${cardWriteType}, docId: ${cardDocId}`);
                throw new Error(`Invalid birthday card write type. ${cardWriteType}, docId: ${cardDocId}`);
            }
        };

        return await firestoreWriteWithAutoRetry(writeCard, 'writeBirthdayCard');
    } catch (error) {
        console.error('Error in writeBirthdayCard:', error);
        throw new Error(`Write Birthday Card failed: ${error.message}`, { cause: error });
    }
};

const updateParticipantCorrection = async (participantData) => {
    try {
        const snapshot = await db.collection('participants').where('token', '==', participantData['token']).get();
        printDocsCount(snapshot, "updateParticipantCorrection");
        if (snapshot.empty) return false
        const docId = snapshot.docs[0].id;
        delete  participantData['token']

        if (participantData['state.148197146'] === 'NULL') {
            delete participantData['state.148197146']
            await db.collection('participants').doc(docId).update({
                'state.148197146': admin.firestore.FieldValue.delete()
            });
        }
        if (Object.keys(participantData).length > 0) { // performs an update only if other key/value exists
            await db.collection('participants').doc(docId).update(
                {...participantData}
            )
        }
        return true;
    } catch(error) {
        console.error(error);
        return new Error(error);
    }
}

/**
 * Reset participant survey status
 * @param {string} connectId - Connect ID of the participant
 * @param {string} survey - Survey concept to be reset, Ex. concept Id reference for ssnStatusFlag (126331570)
 * @returns {object} - Updated participant document
 * For now, only ssn survey is supported
 */
const resetParticipantSurvey = async (connectId, survey) => { 
    try {
        const batch = db.batch();

        const participantSnapshot = await db.collection('participants').where('Connect_ID', '==', connectId).get();
        if (participantSnapshot.empty) {
            throw { message: 'Participant not found.', code: 404 };
        }

        const participantRef = participantSnapshot.docs[0].ref;
        const participantData = participantSnapshot.docs[0].data();
        const { ssnStatusFlag, ssnSurveyStartTime, ssnSurveyCompletedTime, ssnFullGiven, ssnPartialGiven,
            notStarted, ssnFullGivenTime, ssnPartialGivenTime, no } = fieldMapping;

        // early exit if survey is already in not started status
        if (participantData[ssnStatusFlag] === notStarted)  {
            throw {
                message: 'Failed to reset SSN Survey. The participant\'s SSN survey is "Not Started" status!',
                code: 400
            };
        }

        let ssnDocRef;

        // Reset participant data
        if (Number(survey) === ssnStatusFlag) {
            const ssnSnaphot = await db.collection('ssn').where('token', '==', participantData['token']).get();

            if (!ssnSnaphot.empty) { 
                ssnDocRef = ssnSnaphot.docs[0].ref;
                // delete ssn document
                batch.delete(ssnDocRef);
            }

            // update participant document
            batch.update(participantRef, {
                [ssnStatusFlag]: notStarted,
                [ssnSurveyStartTime]: FieldValue.delete(),
                [ssnSurveyCompletedTime]: FieldValue.delete(),
                [ssnFullGiven]: no,
                [ssnPartialGiven]: no,
                [ssnFullGivenTime]: FieldValue.delete(),
                [ssnPartialGivenTime]: FieldValue.delete(),
            });
            await batch.commit();
            const updatedDoc = await participantRef.get();
            return updatedDoc.data();
        }

        // Add future surveys here later
        throw { message: `Survey type ${survey} failed to reset.`, code: 400 };

    } catch (error) {
        if (error.code) throw error; 
        console.error('Error resetting participant survey:', error);

        throw {
            message: `Error resetting participant survey. ${error.message}`,
            code: 500,
        };
        
    }
};

/**
 * Update participant incentive eligibility for NORC Incentive Eligibility tool
 * @param {string} connectId - Connect ID of the participant
 * @param {string} currentPaymentRound - Payment round to update eligibility for participant
 * @param {string} dateOfEligibilityInput - Date of eligibility for incentive ISO 8601 format
 * @returns {object} - Updated participant document
*/
const updateParticipantIncentiveEligibility = async (connectId, currentPaymentRound, dateOfEligibilityInput) => { 
    try {
        const { paymentRound, eligibleForIncentive, yes, no, norcPaymentEligibility, timestampPaymentEligibilityForRound } = fieldMapping;

        const snapshot = await db.collection('participants').where('Connect_ID', '==', connectId).get();
        if (snapshot.empty) throw { message: 'Participant not found.', code: 404 };
        const participantRef = snapshot.docs[0].ref;
        const participantData = snapshot.docs[0].data();
        const currentPaymentRoundName = currentPaymentRound; // baseline or future payment rounds

        const isNORCPaymentEligible = participantData?.[paymentRound]?.[currentPaymentRound]?.[norcPaymentEligibility] === no;
        const isIncentiveEligible = participantData?.[paymentRound]?.[currentPaymentRound]?.[eligibleForIncentive] === no;
        const isEligibleForIncentiveUpdate = isNORCPaymentEligible && isIncentiveEligible;

        if (isEligibleForIncentiveUpdate) {
            await participantRef.update({
                [`${paymentRound}.${currentPaymentRoundName}.${eligibleForIncentive}`]: yes,
                [`${paymentRound}.${currentPaymentRoundName}.${norcPaymentEligibility}`]: yes,
                [`${paymentRound}.${currentPaymentRoundName}.${timestampPaymentEligibilityForRound}`]: dateOfEligibilityInput
            });
            const updatedDoc = await participantRef.get();
            if (!updatedDoc.exists) throw { message: 'Updated document not found.', code: 404 }
            return updatedDoc.data();
        } else {
            throw {
                message: 'Participant is already eligible for incentive and cannot be updated!',
                code: 400,
            }
        }
    } catch (error) {
        if (error.code) throw error; 
        console.error('Error updating  participant incentive eligibility:', error);

        throw {
            message: `Error updating  participant incentive eligibility: ${error.message}`,
            code: 500
        };
    }
};


const generateSignInWithEmailLink = async (email, continueUrl) => {
    return await admin.auth().generateSignInWithEmailLink(email, {
        url: continueUrl,
        handleCodeInApp: true,
    });
};

/**
 * Get the app settings from Firestore.
 * @param {String} appName  - Name of the app (e.g. 'connectApp', 'biospecimen', 'smdb')
 * @param {Array<string>} selectedParamsArray - Array of parameters to retrieve from the document.
 * @returns {Object} - App settings object.
 */
const getAppSettings = async (appName, selectedParamsArray) => {
    try {
        const snapshot = await db.collection('appSettings')
            .where('appName', '==', appName)
            .select(...selectedParamsArray)
            .get();
        
        if (!snapshot.empty) {
            return snapshot.docs[0].data();
        } else {
            console.error(`No app settings found for ${appName}. Parameters requested: ${selectedParamsArray.join(', ')}`);
            return {};
        }
    } catch (error) {
        console.error(`Error fetching app settings for ${appName}.`, error);
        throw new Error("Error fetching app settings.", { cause: error });
    }
}

/**
 * Update Notify message delivery status to Firestore.
 * @param {Object} data 
 */
const updateNotifySmsRecord = async (data) => {
  const snapshot = await db
    .collection("notifications")
    .where("phone", "==", data.phone)
    .where("twilioNotificationSid", "==", data.twilioNotificationSid)
    .get();

    if (snapshot.size === 1) {
      await snapshot.docs[0].ref.update(data);
      return true;
    }

    return false;
};

/**
 * 
 * @param {string} phoneNumber Phone number in +1XXXXXXXXXX format
 * @param {boolean} isSmsPermitted Whether SMS is permitted or not
 * @returns {Promise<number>} Number of document(s) updated
 */
const updateSmsPermission = async (phoneNumber, isSmsPermitted) => {
  let count = 0;
  const permissionCid = isSmsPermitted ? fieldMapping.yes : fieldMapping.no;
  const tokenArray = await getParticipantTokensByPhoneNumber(phoneNumber);
  if (tokenArray.length > 0) {
    const batch = db.batch();
    for (const token of tokenArray) {
      const snapshot = await db.collection("participants").where("token", "==", token).select().get();
      if (!snapshot.empty) {
        batch.update(snapshot.docs[0].ref, { [fieldMapping.canWeText]: permissionCid });
        count++;
      }
    }
    await batch.commit();
  }

  return count;
};

/**
 * Generic function to write to Firestore with automatic retries.
 * @param {Function} asyncWriteFunction - Firestore write operation to perform.
 * @param {string} operationName - Name of the Firestore write operation for logging purposes.
 * @param {number} maxRetries - Maximum number of write retries.
 * @param {number} delay - Time (milliseconds) to wait between retries.
 * @returns {Promise} - Promise that resolves with the result of the Firestore write operation.
 */

const firestoreWriteWithAutoRetry = async (asyncWriteFunction, operationName, maxRetries = 3, delay = 1000) => {
    let lastError;
    for (let retries = 0; retries < maxRetries; retries++) {
        try {
            return await asyncWriteFunction();
        } catch (error) {
            console.error(`${operationName} failed (attempt ${retries + 1}/${maxRetries}):`, error);
            lastError = error;
            if (retries < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error(`${operationName} failed after ${maxRetries} retries.`, { cause: lastError });
};

module.exports = {
    db,
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
    resetParticipantHelper,
    storeNotificationTokens,
    notificationTokenExists,
    retrieveUserNotifications,
    filterDB,
    validateBiospecimenUser,
    biospecimenUserList,
    biospecimenUserExists,
    addNewBiospecimenUser,
    removeUser,
    processParticipantHomeMouthwashKitData,
    storeSpecimen,
    submitSpecimen,
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
    updateParticipantRecord,
    retrieveParticipantsEligibleForIncentives,
    removeParticipantsDataDestruction,
    removeUninvitedParticipants,
    getNotificationSpecifications,
    storeNotification,
    checkIsNotificationSent,
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
    getNotificationSpecById,
    getNotificationSpecByCategoryAndAttempt,
    getEmailNotifications,
    getNotificationSpecsBySchedule,
    getNotificationSpecsByScheduleOncePerDay,
    getKitAssemblyData,
    storeSiteNotifications,
    getCoordinatingCenterEmail,
    getSiteEmail,
    getSiteAcronym,
    getSiteMostRecentBoxId,
    retrieveSiteNotifications,
    addPrintAddressesParticipants,
    getParticipantsByKitStatus,
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
    getSpecimensByReceivedDate,
    getSpecimensByCollectionIds,
    getBoxesByBoxId,
    searchSpecimenBySiteAndBoxId,
    getUnshippedBoxes,
    getSpecimensByBoxedStatus,
    addKitAssemblyData,
    updateKitAssemblyData,
    queryHomeCollectionAddressesToPrint,
    queryCountHomeCollectionAddressesToPrint,
    checkCollectionUniqueness,
    processVerifyScannedCode,
    assignKitToParticipant,
    confirmShipmentKit,
    storeKitReceipt,
    addKitStatusToParticipant,
    eligibleParticipantsForKitAssignment,
    processSendGridEvent,
    processTwilioEvent,
    getSpecimenAndParticipant,
    queryKitsByReceivedDate,
    getParticipantCancerOccurrences,
    writeCancerOccurrences,
    writeBirthdayCard,
    getExistingBirthdayCard,
    updateParticipantCorrection,
    resetParticipantSurvey,
    generateSignInWithEmailLink,
    getAppSettings,
    updateNotifySmsRecord,
    updateSmsPermission,
    updateParticipantIncentiveEligibility,
}