const { getResponseJSON, setHeaders, setHeadersDomainRestricted } = require('./shared');

const submit = async (res, data, uid) => {
    // Remove locked attributes.
    const { lockedAttributes } = require('./shared');
    lockedAttributes.forEach(atr => delete data[atr]);
    
    const { retrieveUserProfile } = require('./firestore');
    const userProfile = (await retrieveUserProfile(uid))[0];
    const recruitType = userProfile['512820379'] === 486306141 ? 'active' : 'passive';
    
    if(data[827220437]) { 
        const { incrementCounter } = require('./firestore');
        await incrementCounter(`${recruitType}.count`, data[827220437]);
        await incrementCounter(`passive.signedIn`, data[827220437]);
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

const getParticipants = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req);
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const { isParentEntity } = require('./shared');
    const {isParent, siteCodes} = await isParentEntity(authorized)
    if(!req.query.type) return res.status(404).json(getResponseJSON('Resource not found', 404));

    if(req.query.limit && parseInt(req.query.limit) > 1000) return res.status(400).json(getResponseJSON('Bad request, the limit cannot exceed more than 1000 records!', 400));

    let queryType = '';
    const limit = req.query.limit ? parseInt(req.query.limit) : 500;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    if(req.query.type === 'verified') queryType = req.query.type;
    else if (req.query.type === 'notyetverified') queryType = req.query.type;
    else if (req.query.type === 'cannotbeverified') queryType = req.query.type;
    else if (req.query.type === 'profileNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'consentNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'notSignedIn') queryType = req.query.type;
    else if (req.query.type === 'all') queryType = req.query.type;
    else if (req.query.type === 'stats') queryType = req.query.type;
    else if (req.query.type === 'individual'){
        if (req.query.token) {
            queryType = "individual";
            const { individualParticipant } = require(`./firestore`);
            const response = await individualParticipant('token', req.query.token, siteCodes, isParent);
            if(!response) return res.status(404).json(getResponseJSON('Resource not found', 404));
            if(response instanceof Error) res.status(500).json(getResponseJSON(response.message, 500));
            if(response) return res.status(200).json({data: response, code: 200})
        }
        else{
            return res.status(400).json(getResponseJSON('Bad request', 400));
        }
    }
    else if(req.query.type === 'filter') {
        const queries = req.query;
        delete queries.type;
        if(Object.keys(queries).length === 0) return res.status(400).json(getResponseJSON('Please include parameters to filter data.', 400));
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
    const data = await retrieveParticipants(siteCodes, queryType, isParent, limit, page);

    if(data instanceof Error){
        return res.status(500).json(getResponseJSON(data.message, 500));
    }

    return res.status(200).json({data, code:200, limit, dataSize: data.length})
}

const identifyParticipant = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only GET or POST requests are accepted!', 405));
    }

    if(req.method === 'GET') {
        if(!req.query.type || req.query.type.trim() === ""){
            return res.status(401).json(getResponseJSON('Type is missing!', 401));
        }
    
        if(!req.query.token || req.query.token.trim() === ""){
            return res.status(401).json(getResponseJSON('Token is missing!', 401));
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

        const type = req.query.type;
        const token = req.query.token;
        console.log(`identifyParticipant type: - ${type} and participant token: - ${token}`);

        if(type !== 'verified' && type !== 'cannotbeverified' && type !== 'duplicate' && type !== 'outreachtimedout') return res.status(400).json(getResponseJSON('Type not supported!', 400));
        
        const { verifyIdentity } = require('./firestore');
        const identify = await verifyIdentity(type, token, siteCode);
        if(identify instanceof Error){
            return res.status(500).json(getResponseJSON(identify.message, 500));
        }

        if(identify){
            return res.status(200).json(getResponseJSON('Success!', 200));
        }
    }
    else if (req.method === 'POST') {
        if(req.body.data === undefined || req.body.data.length === 0 || req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request!', 400));
        
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }

        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        const siteCode = authorized.siteCode;

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
                    const identified = await verifyIdentity(type, token, siteCode);
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
    uploadFile
}