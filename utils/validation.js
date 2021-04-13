const { getResponseJSON, setHeaders, setHeadersDomainRestricted, incentiveFlags } = require('./shared');

const generateToken = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    console.log(req.method);
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    console.log(req.headers.authorization);
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    const decodedToken = await validateIDToken(idToken);

    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }

    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    console.log(decodedToken.uid);
    const { participantExists } = require('./firestore')
    const userAlreadyExists = await participantExists(decodedToken.uid);

    if(userAlreadyExists){
        return res.status(401).json(getResponseJSON('Account already exists', 401));
    }
    const uuid = require('uuid');
    const { incentiveFlags, defaultFlags } = require('./shared');
    const obj = {
        state: { uid: decodedToken.uid, 
            875549268: 104430631 
        },
        230663853: 353358909,
        token: uuid(),
        512820379: 854703046, // defaulting it as passive
        471593703: (new Date()).toISOString(),
        ...incentiveFlags,
        ...defaultFlags
    }
    console.log(JSON.stringify(obj));
    const { createRecord } = require('./firestore');
    createRecord(obj);
    return res.status(200).json(getResponseJSON('Ok', 200));
}

const validateToken = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    console.log(req.method);
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    console.log(req.headers.authorization);
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    const decodedToken = await validateIDToken(idToken);

    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }

    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    console.log(decodedToken.uid+' '+JSON.stringify(req.query));
    const { participantExists } = require('./firestore')
    const userAlreadyExists = await participantExists(decodedToken.uid);

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
            linkParticipanttoFirebaseUID(isValid , decodedToken.uid);
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
            await linkParticipanttoFirebaseUID(isValid , decodedToken.uid);
            const obj = {
                948195369: 353358909
            }
            const { updateResponse } = require('./firestore');
            updateResponse(obj, decodedToken.uid);
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
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    if(authObj) {
        return res.status(200).json(getResponseJSON('Ok', 200));
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

const validateUserSession = (req, res) => {
    const admin = require('firebase-admin');
    admin.initializeApp({
            keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
        });
    const idToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI5NGNlMzNhNWQ3MmI0NjYyNzI3ZGFiYmRhNzVjZjg4Y2Y5OTg4MGUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQmhhdW1payBQYXRlbCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9uaWgtbmNpLWRjZWctZXBpc3BoZXJlLWRldiIsImF1ZCI6Im5paC1uY2ktZGNlZy1lcGlzcGhlcmUtZGV2IiwiYXV0aF90aW1lIjoxNTY5OTUwMDY4LCJ1c2VyX2lkIjoicU9PM3p0UXpWRFhZRDZWWkt3Ulh5ZjF2ektoMiIsInN1YiI6InFPTzN6dFF6VkRYWUQ2VlpLd1JYeWYxdnpLaDIiLCJpYXQiOjE1Njk5NTExODMsImV4cCI6MTU2OTk1NDc4MywiZW1haWwiOiJiaGF1bWlrNzIzMEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJiaGF1bWlrNzIzMEBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.0z9KNaWNJV3eEZ5DmSDNfVwlUfUWhMPSUIxvJk5eZXECbQV1qtnQvmSVHWJ2TOA5fX-Igx8Eb5viu4Ad5nb_Ew1ElDmDXXMpdDeWFjbqx5uh-UHC7kj1b2Xee8gKFA59ZS4f9tooUPZgpmZ_AiTJFu74V3Q5f8nw1tI38nrnqaECVfnCp7uXBoL-2AnMevdMz58P5sv_4abWTD76PIF0NYrX9xGPOUTTZPGpe9CJVWrBmKGp52eIqe6ix-v0yfeg2WSDpCwUiZmohN-coL41Abdasifw6UFsJzNdhQsrj1b9QLu7n-bjtjfprDq8UIGa2IC8IX3qQPpSjtWdKgkT7Q';
    admin.auth().verifyIdToken(idToken)
    .then(function(decodedToken) {
        console.log(decodedToken)
        let uid = decodedToken.uid;
        // ...
    }).catch(function(error) {
        // Handle error
    });
}

const getToken = async (req, res) => {
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
                    const { incentiveFlags, defaultFlags } = require('./shared');
                    const obj = {
                        state: { studyId, 
                            875549268: 104430631 
                        },
                        827220437: siteCode,
                        512820379: 180583933, // default recruit type not-active
                        230663853: 104430631,
                        pin: PIN,
                        token: uuid(),
                        ...incentiveFlags,
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

module.exports = {
    generateToken,
    validateToken,
    validateSiteUsers,
    validateUserSession,
    getToken
}
