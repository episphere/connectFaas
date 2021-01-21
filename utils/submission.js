const { getResponseJSON, setHeaders, setHeadersDomainRestricted } = require('./shared');

const submit = async (res, data, uid) => {
    const hotProperties = Object.keys(data).filter(k => k.indexOf("state") === 0);
    hotProperties.forEach(key => delete data[key]);
    const { retrieveUserProfile } = require('./firestore');
    const userProfile = (await retrieveUserProfile(uid))[0];
    const recruitType = userProfile['512820379'] === 486306141 ? 'active' : 'passive';
    
    if(data[827220437]) { 
        const { incrementCounter } = require('./firestore');
        await incrementCounter(`${recruitType}.count`, data[827220437]);
    }
    if(data[699625233]) {
        // get site code from participant record.
        const { incrementCounter } = require('./firestore');
        if(userProfile[827220437]) await incrementCounter(`${recruitType}.profileSubmitted`, userProfile[827220437]);
    }
    if(data[919254129] !== undefined && data[919254129] === 353358909) {
        // generate Connect_ID
        const { generateConnectID } = require('./shared');
        const { sanityCheckConnectID, incrementCounter } = require('./firestore');
        if(userProfile[827220437]) await incrementCounter(`${recruitType}.consented`, userProfile[827220437]);
        let boo = false;
        let Connect_ID;
        while(boo === false){
            const ID = generateConnectID();
            const response = await sanityCheckConnectID(ID);
            if(response === true) {
                Connect_ID = ID;
                boo = true;
            }
        }
        data = {...data, Connect_ID}
    }

    const { updateResponse } = require('./firestore');
    const response = await updateResponse(data, uid);
    
    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    if(!response) {
        return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
    }
    return res.status(200).json(getResponseJSON('Data stored successfully!', 200));    
};

const recruitSubmit = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

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

    const data = req.body;
    if(Object.keys(data).length <= 0){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    return submit(res, data, decodedToken.uid);
}

const participantData = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`participantData ${new Date()} ${siteKey}`)
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('Bad request!', 400));

    if(Object.keys(req.body.data).length > 0){
        
    }
}

const getParticipants = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`getParticipants ${new Date()} ${siteKey} ${JSON.stringify(req.query)}`);
    const { validateSiteUser } = require('./firestore');
    const authorized = await validateSiteUser(siteKey);
    if(authorized === false) return res.status(401).json(getResponseJSON('Authorization failed!', 401));

    if(req.query.type === false) return res.status(404).json(getResponseJSON('Resource not found', 404));

    // Get all data if it's a parent
    const ID = authorized.id;
    const { getChildrens } = require('./firestore');
    let siteCodes = await getChildrens(ID);
    let isParent = siteCodes ? true : false;
    siteCodes = siteCodes ? siteCodes : authorized.siteCode;
    console.log('Site codes: - '+siteCodes);
    let queryType = '';
    if(req.query.type === 'verified') queryType = req.query.type;
    else if (req.query.type === 'notyetverified') queryType = req.query.type;
    else if (req.query.type === 'cannotbeverified') queryType = req.query.type;
    else if (req.query.type === 'profileNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'consentNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'notSignedIn') queryType = req.query.type;
    else if (req.query.type === 'all') queryType = req.query.type;
    else if (req.query.type === 'stats') queryType = req.query.type;
    else if (req.query.type === 'eligibleForIncentive') {
        if(authorized.acronym !== 'NORC') return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        // Only NORC should be able to make this call
        queryType = req.query.type
    }
    else if (req.query.type === 'individual'){
        if (req.query.token) {
            queryType = "individual";
            const { individualParticipant } = require(`./firestore`);
            const response = await individualParticipant('token', req.query.token);
            if(!response) return res.status(404).json(getResponseJSON('Resource not found', 404));
            if(response instanceof Error) res.status(500).json(getResponseJSON(response.message, 500));
            if(response) return res.status(200).json({data: response, code: 200})
        }
        else{
            return res.status(404).json(getResponseJSON('Bad request', 400));
        }
    }
    else if(req.query.type === 'filter') {
        const queries = req.query;
        delete queries.type;
        if(Object.keys(queries).length === 0) return res.status(404).json(getResponseJSON('Please include parameters to filter data.', 400));
        const { filterData } = require('./shared');
        const result = await filterData(queries, siteCodes, isParent);
        if(result instanceof Error){
            return res.status(500).json(getResponseJSON(result.message, 500));
        }
        return res.status(200).json({data: result, code: 200})
    }
    else{
        return res.status(404).json(getResponseJSON('Resource not found', 404));
    }
    const { retrieveParticipants } = require(`./firestore`);
    const data = await retrieveParticipants(siteCodes, queryType, isParent);

    if(data instanceof Error){
        return res.status(500).json(getResponseJSON(data.message, 500));
    }

    return res.status(200).json({data, code:200})
}

const identifyParticipant = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only GET or POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    if(req.method === 'GET') {
        if(!req.query.type || req.query.type.trim() === ""){
            return res.status(401).json(getResponseJSON('Type is missing!', 401));
        }
    
        if(!req.query.token || req.query.token.trim() === ""){
            return res.status(401).json(getResponseJSON('Token is missing!', 401));
        }
        const siteKey = req.headers.authorization.replace('Bearer','').trim();
        const { validateSiteUser } = require(`./firestore`);
        const authorize = await validateSiteUser(siteKey);
        if(authorize instanceof Error){
            return res.status(500).json(getResponseJSON(authorize.message, 500));
        }

        if(!authorize){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }

        const type = req.query.type;
        const token = req.query.token;
        console.log(`identifyParticipant ${new Date()} siteKey: -${siteKey}, type: - ${type} and participant token: - ${token}`);

        if(type !== 'verified' && type !== 'cannotbeverified' && type !== 'duplicate' && type !== 'outreachtimedout') return res.status(400).json(getResponseJSON('Type not supported!', 400));
        
        const { verifyIdentity } = require('./firestore');
        const identify = await verifyIdentity(type, token);
        if(identify instanceof Error){
            return res.status(500).json(getResponseJSON(identify.message, 500));
        }

        if(identify){
            return res.status(200).json(getResponseJSON('Success!', 200));
        }
    }
    else if (req.method === 'POST') {
        if(req.body.data === undefined || req.body.data.length === 0 || req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request!', 400));
        const siteKey = req.headers.authorization.replace('Bearer','').trim();
        const { validateSiteUser } = require(`./firestore`);
        const authorize = await validateSiteUser(siteKey);
        if(authorize instanceof Error){
            return res.status(500).json(getResponseJSON(authorize.message, 500));
        }

        if(!authorize){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        const dataArray = req.body.data;
        console.log(dataArray)
        let error = false;
        let errorMsgs = [];
        for(let obj of dataArray) {
            if(obj.token && obj.type) { // If both token and type exists
                const type = obj.type;
                const token = obj.token;

                if(type === 'verified' || type === 'cannotbeverified' || type === 'duplicate' || type === 'outreachtimedout') {
                    const { verifyIdentity } = require('./firestore');
                    const identified = await verifyIdentity(type, token);
                    if(identified instanceof Error) {
                        error = true;
                        errorMsgs.push({token, message: identified.message, code: 404});
                    }
                }
                else {
                    error = true;
                    errorMsgs.push({token, message: 'Type not supported!', code: 400});
                }
            }
            else {
                error = true;
                errorMsgs.push({...obj, message: 'Bad request!', code: 400});
            }
        }
        if(error) return res.status(206).json({code: 206, errorMsgs})
        else return res.status(200).json(getResponseJSON('Success!', 200));
    }
}

const getUserProfile = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

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

    const { retrieveUserProfile } = require('./firestore');
    const response = await retrieveUserProfile(decodedToken.uid);

    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    if(!response){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    if(response){
        return res.status(200).json({data: response[0], code:200});
    }
}

const uploadFile = (req, res) => {
    setHeaders(res);
    const Busboy = require('busboy');
    const bb = new Busboy({ headers: req.headers });

    bb.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
        console.log(`${fieldname} --> ${val}`)
    });

    bb.on('file', async (fieldname, file, filename, encoding, mimetype) => {
        console.log(file._readableState.buffer);
        const { storeFile } = require('./firestore');
        await storeFile(file._readableState.buffer, filename, encoding, mimetype);
    });

    bb.on('finish', () => {
        res.end();
    });

    bb.end(req.rawBody);

    return res.status(200).json('Success!');
}

module.exports = {
    submit,
    recruitSubmit,
    getParticipants,
    identifyParticipant,
    getUserProfile,
    uploadFile,
    participantData
}