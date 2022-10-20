const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');

const generateToken = async (req, res, uid) => {

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { participantExists } = require('./firestore')
    const userAlreadyExists = await participantExists(uid);

    if(userAlreadyExists){
        return res.status(401).json(getResponseJSON('Account already exists', 401));
    }
    const uuid = require('uuid');
    const { defaultFlags, defaultStateFlags } = require('./shared');
    const obj = {
        state: { 
            uid, 
            ...defaultStateFlags
        },
        230663853: 353358909,
        token: uuid(),
        512820379: 854703046, // defaulting it as passive
        471593703: (new Date()).toISOString(),
        ...defaultFlags
    }
    console.log(JSON.stringify(obj));
    const { createRecord } = require('./firestore');
    createRecord(obj);
    return res.status(200).json(getResponseJSON('Ok', 200));
}

const validateToken = async (req, res, uid) => {

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    console.log(uid+' '+JSON.stringify(req.query));
    const { participantExists } = require('./firestore')
    const userAlreadyExists = await participantExists(uid);

    if(userAlreadyExists){
        return res.status(401).json(getResponseJSON('Account already exists', 401));
    }

    if(req.query.token && req.query.token.trim() !== "") {
        const token = req.query.token.trim();

        const { verifyToken } = require('./firestore');
        const isValid = await verifyToken(token);

        if(isValid instanceof Error){
            return res.status(500).json(getResponseJSON(isValid.message, 500));
        }

        if(isValid){ // add uid to participant record
            const { linkParticipanttoFirebaseUID } = require('./firestore');
            linkParticipanttoFirebaseUID(isValid , uid);
            return res.status(200).json(getResponseJSON('Ok', 200));
        }
        else{ // Invalid token
            return res.status(401).json(getResponseJSON('Invalid token', 401));
        }
    }
    else if(req.query.pin && req.query.pin){ // check for PIN
        const pin =  req.query.pin.trim();

        const { verifyPin } = require('./firestore');
        const isValid = await verifyPin(pin);

        if(isValid instanceof Error){
            return res.status(500).json(getResponseJSON(isValid.message, 500));
        }

        if(isValid){ // add uid to participant record
            const { linkParticipanttoFirebaseUID } = require('./firestore');
            await linkParticipanttoFirebaseUID(isValid , uid);
            const obj = {
                948195369: 353358909
            }
            const { updateResponse } = require('./firestore');
            updateResponse(obj, uid);
            return res.status(200).json(getResponseJSON('Ok', 200));
        }
        else{ // Invalid pin
            return res.status(401).json(getResponseJSON('Invalid pin', 401));
        }
    }
    else{
        return res.status(400).json(getResponseJSON('Bad request', 400));
    }
};

const validateSiteUsers = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    if(authObj) {
        return res.status(200).json({message: 'Ok', code: 200, isParent: authObj.isParent, coordinatingCenter: authObj.coordinatingCenter, helpDesk: authObj.helpDesk});
    }
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(401).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    
        return res.status(200).json(getResponseJSON('Ok', 200));
    }
}

const getToken = async (req, res) => {
    logIPAdddress(req);
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req);
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteCode = authorized.siteCode;

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('Bad request!', 400));
    if(req.body.data.length > 0){
        const uuid = require('uuid');
        let responseArray = [];
        if(req.body.data.length > 999) return res.status(400).json(getResponseJSON('Bad request!', 400));
        const data = req.body.data;
        console.log(data);
        for(let dt in data){
            if(data[dt].studyId && data[dt].studyId.trim() !== ""){
                const studyId = data[dt].studyId
                const { recordExists } = require('./firestore');
                const response = await recordExists(studyId, siteCode);

                if(response === false){
                    const { randomString } = require('./shared');
                    
                    let boo = false;
                    let PIN;
                    while(boo === false){
                        const tempPIN = `${randomString()}`
                        const { sanityCheckPIN } = require('./firestore');
                        const response = await sanityCheckPIN(tempPIN);
                        if(response === true) {
                            PIN = tempPIN;
                            boo = true;
                        }
                    }
                    const { defaultFlags, defaultStateFlags } = require('./shared');
                    const obj = {
                        state: { studyId, 
                            ...defaultStateFlags,
                            521025370: new Date().toISOString()
                        },
                        827220437: siteCode,
                        512820379: 180583933, // default recruit type not-active
                        230663853: 104430631,
                        pin: PIN,
                        token: uuid(),
                        ...defaultFlags
                    }
                    const { createRecord } = require('./firestore');
                    await createRecord(obj);
                    responseArray.push({studyId: studyId, token: obj.token, pin: obj.pin});
                } else {
                    response.pin ? responseArray.push({studyId: studyId, token: response.token, pin: response.pin}) : responseArray.push({studyId: studyId, token: response.token});
                }
            } else {
                // Return error?
            }
        };
        return res.status(200).json({data: responseArray, code: 200});
    }
    else {
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
}

const checkDerivedVariables = async (token, siteCode) => {

    const { getParticipantData, getSpecimenCollections } = require('./firestore');

    const data = await getParticipantData(token, siteCode);
    const collections = await getSpecimenCollections(token, siteCode);

    let incentiveEligible = false;

    
    console.log(data['130371375']);
    // incentiveEligible
    if(data['130371375']['266600170']['731498909'] === 104430631) {
        const baselineCollections = collections.data.filter(collection => collection['331584571'] === 266600170);

        const module1 = (data['949302066'] === 231311385);
        const module2 = (data['536735468'] === 231311385);
        const module3 = (data['976570371'] === 231311385);
        const module4 = (data['663265240'] === 231311385);
        const bloodCollected = (data['878865966'] === 353358909) || (data['173836415']?.['266600170']?.['693370086'] === 353358909);    
    
        if(module1 && module2 && module3 && module4) {
            if(bloodCollected) {
                incentiveEligible = true;
            }    
            else {
                /*
                if(baselineCollections.length === 0) return false;

                baselineCollections.forEach(collection => {
                    if(collection[conceptIds.collection.collectionSetting] === conceptIds.research) {
                        tubes.forEach(tube => {
                            if(collection[tube.concept] && collection[tube.concept][conceptIds.REASON_NOT_COLLECTED] && collection[tube.concept][conceptIds.REASON_NOT_COLLECTED] != conceptIds.REASONS.PARTICIPANT_REFUSAL) {
                                eligible = true;
                            }
                        });
                    }
                });
                */
            }
        }
    }




    if(incentiveEligible) {
        const updates = {
            '130371375.266600170.731498909': 353358909,
            '130371375.266600170.222373868': formData['827220437'] === 809703864 ? 104430631 : 353358909,
            '130371375.266600170.787567527': new Date().toISOString(),
            uid: data.state.uid
        };
    } 

    const { updateParticipant } = require('./firestore');
    updateParticipant(updates);
}

const validateUsersEmailPhone = async (req, res) => {
    logIPAdddress(req);
    setHeaders(res);
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    if(!req.query) return res.status(404).json(getResponseJSON('Not valid', 404));
    const { verifyUsersEmailOrPhone } = require('./firestore');
    let result = await verifyUsersEmailOrPhone(req)
    if (result) return res.status(200).json({data: {accountExists: true}, code: 200})
    else return res.status(200).json({data: {accountExists: false}, code: 200})
}

module.exports = {
    generateToken,
    validateToken,
    validateSiteUsers,
    getToken,
    checkDerivedVariables,
    validateUsersEmailPhone
}
