const rules = require("../updateParticipantData.json");
const submitRules = require("../submitParticipantData.json");
const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');
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
    const { getParticipantData, updateParticipantData } = require('./firestore');
    const { checkForQueryFields, initializeTimestamps, userProfileHistoryKeys } = require('./shared');
    const { checkDerivedVariables } = require('./validation');

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
    const primaryIdentifiers = ['token', 'pin', 'Connect_ID', 'state.uid'];

    let responseArray = [];
    let error = false;

    for(let dataObj of dataArray) {
        if(dataObj.token === undefined) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': 'UNDEFINED', 'Errors': 'Token not defined in data object.'}});
            continue;
        } 

        const participantToken = dataObj.token;
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

        const flat = (obj, att, attribute) => {
            for(let k in obj) {
                if(typeof(obj[k]) === 'object' && !Array.isArray(obj[k])) flat(obj[k], att, attribute ? `${attribute}.${k}`: k)
                else {
                    if(att === 'newData' && primaryIdentifiers.indexOf(attribute ? `${attribute}.${k}`: k) !== -1) continue;
                    flattened[att][attribute ? `${attribute}.${k}`: k] = obj[k]
                }
            }
        }

        let updatedData = {};
        let flattened = {
            newData: {},
            docData: {}
        };

        flat(docData, 'docData');

        for(let key in dataObj) {
        
            if(primaryIdentifiers.indexOf(key) !== -1) continue;

            if(typeof(dataObj[key]) === 'object' && !Array.isArray(dataObj[key])) flat(dataObj[key], 'newData', key);
            else flattened['newData'][key] = dataObj[key];

            updatedData = {...updatedData, ...flattened.newData}
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

        if(!authObj) {
            const errors = qc(updatedData, flattened.docData, rules);
            if(errors.length !== 0) {
                error = true;
                responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': errors}});
                continue;
            }
        }

        for(let key in updatedData) {
            if(initializeTimestamps[key]) {
                if(initializeTimestamps[key].value && initializeTimestamps[key].value === updatedData[key]) {
                    updatedData = {...updatedData, ...initializeTimestamps[key].initialize}
                }
            }
        }

        // Handle deceased data. participantDeceased === yes && participantDeceasedTimestamp req'd. Derive participantDeceasedNORC === fieldMapping.yes.
        // Ignore and delete deceased data if participantDeceased === no. Return error for incomplete submission.
        if (updatedData[fieldMapping.participantDeceased] === fieldMapping.yes && updatedData[fieldMapping.participantDeceasedTimestamp]) {
            updatedData[fieldMapping.participantDeceasedNORC] = fieldMapping.yes;
        } else if (updatedData[fieldMapping.participantDeceased] === fieldMapping.no) {
            delete updatedData[fieldMapping.participantDeceased];
            delete updatedData[fieldMapping.participantDeceasedTimestamp];
        } else if (updatedData[fieldMapping.participantDeceased] || updatedData[fieldMapping.participantDeceasedTimestamp]) {
            error = true;
            responseArray.push({
                "Invalid Request": {
                    "Token": participantToken,
                    "Errors": "Invalid participant deceased data. Deceased variable 857217152 and deceased timestamp 772354119 must be provided together. " +
                    "Example: {'857217152': 353358909, '772354119': '2023-12-01T00:00:00.000Z'}. Omit 'no' values."
                }
            });
            continue;
        }

        // Note: Query fields can't be updated directly, they are derived.
        if (dataObj['query']) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Query variables cannot be directly updated through this API. The expected values will be derived automatically.'}});
                continue;
        }

        // Handle updates to query.firstName, query.lastName, query.allPhoneNo, and query.allEmails arrays (these are used for participant search). Derive and add the updated query array to flatDataObj.
        const shouldUpdateQueryFields = checkForQueryFields(dataObj);
        if (shouldUpdateQueryFields) {
            const { updateQueryListFields } = require('./shared');
            if (!updatedData['query']) updatedData['query'] = {};
            updatedData['query'] = updateQueryListFields(dataObj, docData);
        }

        // Handle updates to user profile history. userProfileHistory is an array of objects. Each object has a timestamp and a userProfile object.
        const shouldUpdateUserProfileHistory = userProfileHistoryKeys.some(key => key in updatedData);
        if (shouldUpdateUserProfileHistory) {
            const { updateUserProfileHistory } = require('./shared');
            updatedData[fieldMapping.userProfileHistory] = updateUserProfileHistory(dataObj, docData, siteCodes);
        }


        try {
            if (Object.keys(updatedData).length > 0) {
                await Promise.all([
                    updateParticipantData(docID, updatedData),
                    checkDerivedVariables(participantToken, docData['827220437']),
                ]);
            }
            
            responseArray.push({'Success': {'Token': participantToken, 'Errors': 'None'}});
        } catch (e) {
            // Alert the user about the error for this participant but continue to process the rest of the participants.
            console.error(`Server error updating participant at updateParticipantData & checkDerivedVariables. ${e}`);
            error = true;
            responseArray.push({'Server Error': {'Token': participantToken, 'Errors': `Please retry this participant. Error: ${e}`}});
            continue;
        }
    }

    return res.status(error ? 206 : 200).json({code: error ? 206 : 200, results: responseArray});
}

const qc = (newData, existingData, rules) => {
    const { validPhoneFormat, validEmailFormat } = require('./shared');
    let errors = [];
    for(key in newData) {
        if(key == 'token') continue;

        if(rules[key]) {

            if(rules[key].mustExist && existingData[key] === undefined) {
                errors.push(" Key (" + key + ") must exist before updating");
                continue;
            }

            if(rules[key].dataType) {
                if(rules[key].dataType === 'ISO') {
                    if(typeof newData[key] !== "string" || !(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(newData[key]))) {
                        errors.push(`Data mismatch: ${key} must be ISO 8601 string. Example: '2023-12-15T12:45:52.123Z'` );
                    }
                }
                else if (rules[key].dataType === 'phone') {
                    if (typeof newData[key] !== 'string' || !validPhoneFormat.test(newData[key])) {
                        errors.push(`Data mismatch: ${key} must be a phone number. 10 character string, no spaces, no dashes. Example: '1234567890'`);
                    }
                }
                else if (rules[key].dataType === 'email') {
                    if (typeof newData[key] !== 'string' || !validEmailFormat.test(newData[key])) {
                        errors.push(`Data mismatch: ${key} must be an email address. Example: abc@xyz.com`);
                    }
                }
                else if (rules[key].dataType === 'zipCode') {
                    if (typeof newData[key] !== 'string' || newData[key].length !== 5) {
                        errors.push(`Data mismatch: ${key} zip code must be a 5 character string. Example: '12345'`);
                    }
                }
                else if(rules[key].dataType === 'array') {
                    if(Array.isArray(newData[key])) {
                        for(const element of newData[key]) {
                            if(typeof element !== 'string') {
                                errors.push(" Invalid data type / format in array element for Key (" + key + ")");
                                break;
                            }
                        }
                    }
                    else {
                        errors.push(" Invalid data type / format for Key (" + key + ")");
                    }
                }
                else {
                    if(rules[key].dataType !== typeof newData[key]) {
                        errors.push(" Invalid data type for Key (" + key + ")");
                    }
                    else {
                        if(rules[key].values) {
                            if(rules[key].values.filter(value => value.toString() === newData[key].toString()).length == 0) {
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
    return errors;
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