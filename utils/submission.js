const { getResponseJSON, setHeaders, setHeadersDomainRestricted } = require('./shared');

const submit = async (res, data, uid) => {
    const hotProperties = Object.keys(data).filter(k => k.indexOf("state") === 0);
    hotProperties.forEach(key => delete data[key]);
    if(data.RcrtCS_Consented_v1r0 !== undefined && data.RcrtCS_Consented_v1r0 === 1) {
        // generate Connect_ID
        const { generateConnectID } = require('./shared');
        const { sanityCheckConnectID } = require('./firestore');
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
    if(req.query.type === 'verified') queryType = 'verified';
    else if (req.query.type === 'notyetverified') queryType = 'notyetverified';
    else if (req.query.type === 'cannotbeverified') queryType = 'cannotbeverified';
    else if (req.query.type === 'all') queryType = 'all';
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
        console.log(queries);
        if(Object.keys(queries).length === 0) return res.status(404).json(getResponseJSON('Please include parameters to filter data.', 400));
        const { filterDB } = require('./firestore');
        const result = await filterDB(queries, siteCodes, isParent);
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

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    if(!req.query.type || req.query.type.trim() === ""){
        return res.status(401).json(getResponseJSON('Type is missing!', 401));
    }

    if(!req.query.token || req.query.token.trim() === ""){
        return res.status(401).json(getResponseJSON('Token is missing!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    const type = req.query.type;
    const token = req.query.token;
    console.log(`identifyParticipant ${new Date()} siteKey: -${siteKey}, type: - ${type} and participant token: - ${token}`);
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    let bool = false;
    if(type === 'verified'){
        bool = true;
    }
    else if(type === 'cannotbeverified'){
        bool = false;
    }
    else{
        return res.status(400).json(getResponseJSON('Type not supported!', 400));
    }

    const { verifyIdentity } = require('./firestore');
    const identify = await verifyIdentity(bool, token);
    if(identify instanceof Error){
        return res.status(500).json(getResponseJSON(identify.message, 500));
    }

    if(identify){
        return res.status(200).json(getResponseJSON('Success!', 200));
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

const createAccount = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const data = req.body;
    if(Object.keys(data).length <= 0){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const access_token = req.headers.authorization.replace('Bearer','').trim();

    const email = data.email;
    const password = data.password;

    const bcrypt = require('bcrypt');
    const saltRounds = 13;

    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    
    const { storeCredentials } = require('./firestore');
    const response = await storeCredentials(access_token, email, hash);

    if(response instanceof Error){
        if(response.message === 'Account already exists for this user' || response.message === `Account with email ${email} already exists!`) return res.status(409).json(getResponseJSON(response.message, 409));
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    if(!response){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    return res.status(200).json(getResponseJSON('Success!', 200));
}

const login = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const data = req.body;
    if(Object.keys(data).length <= 0){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }

    const email = data.email;
    const password = data.password;

    const { retrieveAccount } = require('./firestore');
    const response = await retrieveAccount(email, password);

    if(response instanceof Error){
        if(response.message === 'Invalid password!' || response.message === 'Invalid Email!') return res.status(401).json(getResponseJSON(response.message, 401));
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    if(response){
        res.header('expires', response.expires);
        res.header('Set-Cookie', `access_token=${response.access_token}; Expires=${response.expires}`)
        res.status(200).json({access_token: response.access_token, code: 200});
    };
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
    createAccount,
    login,
    uploadFile,
    participantData
}