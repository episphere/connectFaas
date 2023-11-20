const rules = require("../updateParticipantData.json");
const submitRules = require("../submitParticipantData.json");
const { getResponseJSON, setHeaders, flatValidationHandler, flattenObject, handleCancerOccurrences, logIPAdddress, updateQueryNameArray, validateUpdateData } = require('./shared');
const fieldMapping = require('./fieldToConceptIdMapping');

const submitParticipantsData = async (req, res, site) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    let siteCode = '';
    if(site) siteCode = site;
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }

        siteCode = authorized.siteCode;
    }

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('Bad request. Data is not defined in request body.', 400));
    if(!Array.isArray(req.body.data)) return res.status(400).json(getResponseJSON('Bad request. Data must be an array.', 400));
    if(req.body.data.length === 0) return res.status(400).json(getResponseJSON('Bad request. Data array does not have any elements.', 400));
    if(req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request. Data contains more than acceptable limit of 500 records.', 400));

    console.log(req.body.data);
    
    const dataArray = req.body.data;

    let responseArray = [];
    let error = false;

    for(let dataObj of dataArray){
        if(dataObj.token === undefined) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': 'UNDEFINED', 'Errors': 'Token not defined in data object.'}});
            continue;
        }
        
        const participantToken = dataObj.token;
        delete dataObj.token;

        const { getParticipantData } = require('./firestore');
        const record = await getParticipantData(participantToken, siteCode);

        const flat = (obj, att, attribute) => {
            for(let k in obj) {
                if(typeof(obj[k]) === 'object') flat(obj[k], att, attribute ? `${attribute}.${k}`: k)
                else flattened[att][attribute ? `${attribute}.${k}`: k] = obj[k]
            }
        }

        if(!record) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Token does not exist.'}});
            continue;
        }

        const docID = record.id;
        const docData = record.data;

        const dataHasBeenDestroyed =
            fieldMapping.participantMap.dataHasBeenDestroyed.toString();
        if (docData[dataHasBeenDestroyed] === fieldMapping.yes) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Data Destroyed'}});
            continue;
        }

        let flattened = {
            docData: {}
        };

        flat(docData, 'docData');

        let errors = [];
        
        for(let key in dataObj) {

            if(submitRules[key] || submitRules['state.' + key]) {

                if(!submitRules[key]) {
                    let oldKey = key;
                    let newKey = 'state.' + key;

                    dataObj[newKey] = dataObj[oldKey];
                    delete dataObj[oldKey];

                    key = 'state.' + key;
                }

                if(flattened.docData[key]) {
                    errors.push(" Key (" + key + ") cannot exist before updating");
                    continue;
                }

                if(submitRules[key].dataType) {
                    if(submitRules[key].dataType == 'ISO') {
                        if(typeof dataObj[key] !== "string" || !(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(dataObj[key]))) {
                            errors.push(" Invalid data type / format for Key (" + key + ")");
                        }
                    }
                    else {
                        if(submitRules[key].dataType !== typeof dataObj[key]) {
                            errors.push(" Invalid data type for Key (" + key + ")");
                        }
                        else {
                            if(submitRules[key].values) {
                                if(submitRules[key].values.filter(value => value.toString() === dataObj[key].toString()).length == 0) {
                                    errors.push(" Invalid value for Key (" + key + ")");
                                }
                            }
                        }
                    }
                }
            }
            else {
                errors.push(" Key (" + key + ") not found");
            }
        }

        if(errors.length !== 0) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': errors}});
            continue;
        }

        // TODO - "condition stacking" logic

        // If age deidentified data is provided and participant is not passive then make this participant Active
        if(dataObj['state.934298480'] && record.data['512820379'] !== 854703046) { 
            dataObj['512820379'] = 486306141;
            dataObj['471593703'] = new Date().toISOString();
        }

        // If Update recruit type is non-zero
        // Passive to Active
        if(dataObj['state.793822265'] && dataObj['state.793822265'] === 854903954 && record.data['512820379'] === 854703046) dataObj['512820379'] = 486306141;
        // Active to Passive
        if(dataObj['state.793822265'] && dataObj['state.793822265'] === 965707001 && record.data['512820379'] === 486306141) dataObj['512820379'] = 854703046;

        if(Object.keys(dataObj).length > 0) {

            console.log("SUBMITTED DATA");
            console.log(dataObj);

            const { updateParticipantData } = require('./firestore');
            await updateParticipantData(docID, dataObj);
        }

        responseArray.push({'Success': {'Token': participantToken, 'Errors': 'None'}});
    }

    return res.status(error ? 206 : 200).json({code: error ? 206 : 200, results: responseArray});
}

const siteNotificationsHandler = async (Connect_ID, concept, siteCode, obj) => {
    const { handleSiteNotifications } = require('./siteNotifications');
    const { getSiteEmail } = require('./firestore');
    const siteEmail = await getSiteEmail(siteCode);
    await handleSiteNotifications(Connect_ID, concept, siteEmail, obj.id, obj.acronym, siteCode);
}

const updateParticipantData = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
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
    const siteCodes = obj.siteCodes;

    console.log(req.body.data);

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('Bad request. Data is not defined in request body.', 400));
    if(!Array.isArray(req.body.data)) return res.status(400).json(getResponseJSON('Bad request. Data must be an array.', 400));
    if(req.body.data.length === undefined || req.body.data.length < 1) return res.status(400).json(getResponseJSON('Bad request. Data array does not have any elements.', 400));
    if(req.body.data.length > 100) return res.status(400).json(getResponseJSON('Bad request. Data contains more than acceptable limit of 100 records.', 400));

    const dataArray = req.body.data;

    let responseArray = [];
    let error = false;

    // Iterate dataArray, Fetching each participant record from firestore by token.
    participantLoop: for(let dataObj of dataArray) {
        if(dataObj.token === undefined) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': 'UNDEFINED', 'Errors': 'Token not defined in data object.'}});
            continue;
        } 

        const participantToken = dataObj.token;
        const { getParticipantData } = require('./firestore');
        const record = await getParticipantData(participantToken, siteCodes, isParent);

        if(!record) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Token does not exist.'}});
            continue;
        }

        const docID = record.id;
        const docData = record.data;

        const dataHasBeenDestroyed =
            fieldMapping.participantMap.dataHasBeenDestroyed.toString();
        if (docData[dataHasBeenDestroyed] === fieldMapping.yes) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Data Destroyed'}});
            continue;
        }

        // Handle Site Notifications
        if(dataObj['831041022'] && dataObj['747006172'] && dataObj['773707518'] && dataObj['831041022'] === 353358909 && dataObj['747006172'] === 353358909 && dataObj['773707518'] === 353358909){ // Data Destruction
            await siteNotificationsHandler(docData['Connect_ID'], '831041022', docData['827220437'], obj);
        }
        else if (dataObj['747006172'] && dataObj['773707518'] && dataObj['747006172'] === 353358909 && dataObj['773707518'] === 353358909) { // Withdraw Consent
            await siteNotificationsHandler(docData['Connect_ID'], '747006172', docData['827220437'], obj);
        }
        else if(dataObj['773707518'] && dataObj['773707518'] === 353358909) { // Revocation only email
            await siteNotificationsHandler(docData['Connect_ID'], '773707518', docData['827220437'], obj);
        }
        else if (dataObj['987563196'] && dataObj['987563196'] === 353358909) {
            await siteNotificationsHandler(docData['Connect_ID'], '987563196', docData['827220437'], obj);
        }

        // Flatten dataObj and docData for comparison & validation.
        const { flattened: flatDataObj, arrayPaths: flatArrayPaths } = flattenObject(dataObj);
        const { flattened: flatDocData } = flattenObject(docData);

        // Delete primary identifiers from dataObj if they exist. There is no reason to update these through this API.
        const primaryIdentifiers = ['token', 'pin', 'Connect_ID', 'state.uid'];
        for (const identifier of primaryIdentifiers) {
            delete flatDataObj[identifier];
        }

        // Validate incoming data. flatDocData is only used to check the 'mustExist' property in some rules.
        if(!authObj) {
            const errors = flatValidationHandler(flatDataObj, flatDocData, rules, validateUpdateData);
            if(errors.length !== 0) {
                error = true;
                responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': errors}});
                continue;
            }
        }

        // Check initializeTimestamps and init on match. Currently, only one key exists in initializeTimestamps.
        const { initializeTimestamps } = require('./shared')
        const keysForTimestampGeneration = Object.keys(initializeTimestamps);
        for (const key of keysForTimestampGeneration) {
            if (initializeTimestamps[key] && flatDataObj[key] != null) {
                if (initializeTimestamps[key].value && initializeTimestamps[key].value === flatDataObj[key]) {
                    Object.assign(flatDataObj, initializeTimestamps[key].initialize);
                }
            }
        }

        // Handle the array paths: Firestore writes are nuanced for arrays. We either need to manage the array or use FieldValue.arrayUnion & FieldValue.arrayRemove.
        // Manage the array to post entire update with one object. Remove dot notated array data, add complete array data (prepare for Firestore update). Data is already validated. 
        for (const path of flatArrayPaths) {
            let isKeyFound = false;
            for (const key in flatDataObj) {
                if (key in flatDataObj && key.startsWith(path)) {
                    delete flatDataObj[key]; // Delete the dot notation key for keys associated with a arrays.
                    isKeyFound = true;
                }
            }

            if (isKeyFound) {
                // Add the array. Handle cancer occurrences: validate cancer site responses and concatenate new occurrences with existing occurrences.
                if (path === fieldMapping.cancerOccurrence.toString()) {
                    if (dataObj[fieldMapping.cancerOccurrence]) {
                        const existingOccurrences = docData[fieldMapping.cancerOccurrence] || [];
                        const requiredOccurrenceRules = Object.keys(rules).filter(key => key.startsWith(fieldMapping.cancerOccurrence.toString()) && rules[key].required);
                        const occurrenceResult = handleCancerOccurrences(flatDataObj, dataObj, existingOccurrences, requiredOccurrenceRules);
                        if (occurrenceResult.error) {
                            error = true;
                            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': occurrenceResult.message}});
                            continue participantLoop;
                        }
                    }
                    // TODO: extend for userProfile history.
                } else {
                    flatDataObj[path] = [...docData[path], ...dataObj[path]];
                }
            }
        }

        
        // Handle updates to query.firstName and query.lastName arrays (these are used for participant search). firstName, prefName, and lastName. Consent name does not get updated.
        // Note: Name fields can be updated directly. Query.name fields are managed. Do not allow direct updates to query.name fields. Add the updated query array to flatDataObj.
        if (dataObj['query']) {
            error = true;
                responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Query variables cannot be directly updated through this API.'}});
                continue;
        }

        if (dataObj[fieldMapping.firstName] || dataObj[fieldMapping.preferredName] || dataObj[fieldMapping.lastName]) {
            flatDataObj['query'] = { ...docData['query'] };
            if (dataObj[fieldMapping.firstName] || dataObj[fieldMapping.preferredName]) {
                let queryFirstNameArray = docData['query']['firstName'] || [];
                if (dataObj[fieldMapping.firstName]) updateQueryNameArray(dataObj[fieldMapping.firstName], docData[fieldMapping.firstName], queryFirstNameArray);
                if (dataObj[fieldMapping.preferredName]) updateQueryNameArray(dataObj[fieldMapping.preferredName], docData[fieldMapping.preferredName], queryFirstNameArray);
                flatDataObj['query']['firstName'] = queryFirstNameArray;
            }
            if (dataObj[fieldMapping.lastName]) {
                let queryLastNameArray = docData['query']['lastName'] || [];
                updateQueryNameArray(dataObj[fieldMapping.lastName], docData[fieldMapping.lastName], queryLastNameArray);
                flatDataObj['query']['lastName'] = queryLastNameArray;
            }
        }

        console.log("UPDATED DATA");
        console.log(flatDataObj);

        if (Object.keys(dataObj).length > 0) {
            const { updateParticipantData } = require('./firestore');
            const { checkDerivedVariables } = require('./validation');
            await updateParticipantData(docID, flatDataObj);
            await checkDerivedVariables(participantToken, docData['827220437']);
        } 

        responseArray.push({'Success': {'Token': participantToken, 'Errors': 'None'}});
    }

    return res.status(error ? 206 : 200).json({code: error ? 206 : 200, results: responseArray});
}

const updateUserAuthentication = async (req, res, authObj) => {
    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(req.body.data === undefined) {
        return res.status(400).json(getResponseJSON('Bad request. Data is not defined in request body.', 400));
    }

    const permSiteArray = ['NIH', 'NORC'];
    if (!permSiteArray.includes(authObj.acronym)) {
        return res.status(403).json(getResponseJSON('You are not authorized!', 403));
    }

    const { updateUserPhoneSigninMethod, updateUserEmailSigninMethod, updateUsersCurrentLogin } = require('./firestore');
    let status = ``
    if (req.body.data['phone'] && req.body.data.flag === `replaceSignin`) status = await updateUserPhoneSigninMethod(req.body.data.phone, req.body.data.uid);
    if (req.body.data['email'] && req.body.data.flag === `replaceSignin`) status = await updateUserEmailSigninMethod(req.body.data.email, req.body.data.uid);
    if (req.body.data.flag === `updateEmail` || req.body.data.flag === `updatePhone`) status = await updateUsersCurrentLogin(req.body.data, req.body.data.uid);
    if (status === true) return res.status(200).json({code: 200});
    else if (status === `auth/phone-number-already-exists`) return res.status(409).json(getResponseJSON('The user with provided phone number already exists.', 409));
    else if (status === `auth/email-already-exists`) return res.status(409).json(getResponseJSON('The user with the provided email already exists.', 409));
    else if (status === `auth/invalid-phone-number`) return res.status(403).json(getResponseJSON('Invalid Phone number', 403));
    else if (status === `auth/invalid-email`) return res.status(403).json(getResponseJSON('Invalid Email', 403));
    else return res.status(400).json(getResponseJSON('Operation Unsuccessful', 400));
}

module.exports = {
    submitParticipantsData,
    updateParticipantData,
    updateUserAuthentication
}