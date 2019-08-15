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

    const access_token = req.headers.authorization.replace('Bearer','').trim();
    const { validateKey } = require(`./firestore`);
    const authorize = await validateKey(access_token);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    if(req.url.indexOf('/submit/') !== -1){
        let data = req.body;
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

    if(!req.query.userId || req.query.userId.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    const userId = req.query.userId;
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey, userId);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
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

    if(!req.query.userId || req.query.userId.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    if(!req.query.type || req.query.type.trim() === ""){
        return res.status(401).json(getResponseJSON('Type is missing!', 401));
    }

    if(!req.query.token || req.query.token.trim() === ""){
        return res.status(401).json(getResponseJSON('Token is missing!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    const userId = req.query.userId;
    const type = req.query.type;
    const token = req.query.token;
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey, userId);

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

module.exports = {
    submit,
    recruitSubmit,
    getParticipants,
    identifyParticipant,
    getUserProfile
}