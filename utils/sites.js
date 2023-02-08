const rules = require("../updateParticipantData.json");
const submitRules = require("../submitParticipantData.json");
const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');

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
    if(req.body.data.length === undefined || req.body.data.length < 1) return res.status(400).json(getResponseJSON('Bad request. Data array does not have any elements.', 400));
    if(req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request. Data contains more than acceptable limit of 500 records.', 400));

    console.log(req.body.data);
    
    const dataArray = req.body.data;

    let responseArray = [];
    let error = false;

    //let errorMsgs = [];

    for(let dataObj of dataArray){
        if(dataObj.token === undefined) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': 'UNDEFINED', 'Errors': 'Token not defined in data object.'}});
            continue;
        }
        
        const participantToken = dataObj.token;
        const { getParticipantData } = require('./firestore');
        const record = await getParticipantData(participantToken, siteCodes);

        if(!record) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Token does not exist.'}});
            continue;
        }

        const docID = record.id;
        const docData = record.data;

        let errors = [];
        
        for(let key in dataObj) {

            if(key == 'token') continue;

            if(docData[key]) {
                errors.push(" Key (" + key + ") cannot exist before updating");
                continue;
            }

            if(submitRules[key]) {
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
        if(dataObj['934298480'] && record.data['512820379'] !== 854703046) { 
            dataObj['512820379'] = 486306141;
            dataObj['471593703'] = new Date().toISOString();
        }

        // If Update recruit type is non-zero
        // Passive to Active
        if(dataObj['793822265'] && dataObj['793822265'] === 854903954 && record.data['512820379'] === 854703046) dataObj['512820379'] = 486306141;
        // Active to Passive
        if(dataObj['793822265'] && dataObj['793822265'] === 965707001 && record.data['512820379'] === 486306141) dataObj['512820379'] = 854703046;

        if(Object.keys(dataObj).length > 0) {
            const { updateParticipantData } = require('./firestore');
            await updateParticipantData(docID, dataObj);
        }
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
        const { getParticipantData } = require('./firestore');
        const record = await getParticipantData(participantToken, siteCodes, isParent);

        if(!record) {
            error = true;
            responseArray.push({'Invalid Request': {'Token': participantToken, 'Errors': 'Token does not exist.'}});
            continue;
        }

        const docID = record.id;
        const docData = record.data;

        const flat = (obj, att, attribute) => {
            for(let k in obj) {
                if(typeof(obj[k]) === 'object') flat(obj[k], att, attribute ? `${attribute}.${k}`: k)
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

            if(typeof(dataObj[key]) === 'object') flat(dataObj[key], 'newData', key);
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

        const { initializeTimestamps } = require('./shared')

        for(let key in updatedData) {
            if(initializeTimestamps[key]) {
                if(initializeTimestamps[key].value && initializeTimestamps[key].value === updatedData[key]) {
                    updatedData = {...updatedData, ...initializeTimestamps[key].initialize}
                }
            }
        }

        if(updatedData['399159511']) updatedData[`query.firstName`] = dataObj['399159511'].toLowerCase();
        if(updatedData['996038075']) updatedData[`query.lastName`] = dataObj['996038075'].toLowerCase();

        console.log("UPDATED DATA");
        console.log(updatedData);

        if(Object.keys(updatedData).length > 0) {

            const { updateParticipantData } = require('./firestore');
            const { checkDerivedVariables } = require('./validation');

            await updateParticipantData(docID, updatedData);
            await checkDerivedVariables(participantToken, docData['827220437']);
        } 

        responseArray.push({'Success': {'Token': participantToken, 'Errors': 'None'}});
    }

    return res.status(error ? 206 : 200).json({code: error ? 206 : 200, results: responseArray});
}

const qc = (newData, existingData, rules) => {
    let errors = [];
    for(key in newData) {
        if(key == 'token') continue;

        if(rules[key]) {

            if(rules[key].mustExist && existingData[key] === undefined) {
                errors.push(" Key (" + key + ") must exist before updating");
                continue;
            }

            if(rules[key].dataType) {
                if(rules[key].dataType == 'ISO') {
                    if(typeof newData[key] !== "string" || !(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(newData[key]))) {
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

module.exports = {
    submitParticipantsData,
    updateParticipantData
}