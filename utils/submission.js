const { getResponseJSON, setHeaders } = require('./shared');

const submit = async (res, data) => {
    
    const hotProperties = Object.keys(data).filter(k => k.indexOf("state") === 0);
    hotProperties.forEach(key => delete data[key]);
    
    const { updateResponse } = require('./firestore');
    const response = await updateResponse(data);
    
    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    if(!response) {
        return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
    }
    return res.status(200).json(getResponseJSON('Data stored successfully!', 200));    
};

const recruitSubmit = async (req, res) => {
    setHeaders(res);

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
        return res.status(500).json(getResponseJSON(decodedToken.message, 500));
    }

    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    if(req.url.indexOf('/submit/') !== -1){
        const data = req.body;
        if(Object.keys(data).length <= 0){
            return res.status(400).json(getResponseJSON('Bad request!', 400));
        }
        return submit(res, data)
    }
    else{
        return res.status(400).json(getResponseJSON('Bad request!', 400));
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
    
    let decider = "";
    if(req.url.indexOf('/verified') !== -1){
        decider = "verified";
    }
    else if(req.url.indexOf('/notverified') !== -1){
        decider = "notverified";
    }
    else if (req.url.indexOf('/all') !== -1){
        decider = "all";
    }
    else{
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }

    const { retrieveParticipants } = require(`./firestore`);
    const data = await retrieveParticipants(siteKey, decider);

    if(data instanceof Error){
        return res.status(500).json(getResponseJSON(data.message, 500));
    }

    if(!data){
        return res.status(401).json(getResponseJSON('No records found!', 500));
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
    else if(type === 'notverified'){
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
        return res.status(200).json(getResponseJSON('Success!!', 200));
    }
}

const getUserProfile = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const access_token = req.headers.authorization.replace('Bearer','').trim();

    const { retrieveUserProfile } = require('./firestore');
    const response = await retrieveUserProfile(access_token);

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

    return res.status(200).json(getResponseJSON('Success!!', 200));
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
    uploadFile
}