const rules = require("../updateParticipantData.json");

const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');

const submitParticipantsData = async (req, res, site) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    let siteCode = '';
    if(site) {
        siteCode = site;
    }
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

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('data is undefined in request body.', 400));
    if(req.body.data.length === undefined || req.body.data.length < 1) return res.status(400).json(getResponseJSON('data array doesn\'t have any element.', 400));

    if(req.body.data.length > 499) return res.status(400).json(getResponseJSON('More than acceptable limit of 500 records.', 400));

    const data = req.body.data;
    console.log(`${JSON.stringify(data)}`);
    let error = false;
    let errorMsgs = [];
    for(let obj of data){
        if(obj.token){
            const participantToken = obj.token;
            const { getParticipantData } = require('./firestore');
            const record = await getParticipantData(participantToken, siteCode);
            if(record){
                const docID = record.id;
                delete obj.token;
                let newStateElements = {}
                for(let key in obj) {
                    if(record.data.state[key] === undefined){
                        newStateElements[`state.${key}`] = obj[key];
                    }
                    // Make participant active if Study invitaion is sent.
                    if(key === '934298480' && record.data['512820379'] !== 854703046) { // If age deidentified data is provided and participant is not passive then make this participant Active
                        newStateElements['512820379'] = 486306141;
                        newStateElements['471593703'] = new Date().toISOString();
                    }
                    // If Update recruit type is non-zero
                    // Passive to Active
                    if(key === '793822265' && obj['793822265'] === 854903954 && record.data['512820379'] === 854703046) newStateElements['512820379'] = 486306141;
                    // Active to Passive
                    if(key === '793822265' && obj['793822265'] === 965707001 && record.data['512820379'] === 486306141) newStateElements['512820379'] = 854703046;

                }
                const { updateParticipantData } = require('./firestore');
                if(Object.keys(newStateElements).length > 0) updateParticipantData(docID, newStateElements);
            }
            else {
                console.log(`Invalid token ${obj.token}`)
                error = true;
                errorMsgs.push({token: participantToken, message: 'Invalid token!', code: 404});
            }
        }
        else {
            console.log(`Record doesn't contain any token ${JSON.stringify(obj)}`)
            error = true;
            errorMsgs.push({...obj, message: 'token missing!', code: 400});
        }
    }
    if(error) return res.status(206).json({code: 206, errorMsgs})
    else return res.status(200).json(getResponseJSON('Success!', 200));
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
            const errors = qc(updatedData, docData, rules);
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
        if(updatedData['996038075']) updatedData[`query.firstName`] = dataObj['996038075'].toLowerCase();

        console.log(updatedData);

        const { updateParticipantData } = require('./firestore');
        if(Object.keys(updatedData).length > 0) updateParticipantData(docID, updatedData);

        responseArray.push({'Success': {'Token': participantToken, 'Errors': 'None'}});
    }

    return res.status(error ? 206 : 200).json({code: error ? 206 : 200, results: responseArray});
}

const qc = (newData, existingData, rules) => {
    console.log("ND");
    console.log(newData);
    console.log("ED");
    console.log(existingData)
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