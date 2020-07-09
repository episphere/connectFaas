const { getParticipants } = require("./submission");
const { getResponseJSON, setHeaders } = require('./shared');

const biospecimenAPIs = (req, res) => {
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    console.log(api)
    if(api === 'getParticipants') return getParticipants(req, res);
    if(api === 'validateUsers') return validateUsers(req, res);
    else return res.status(400).json(getResponseJSON('Bad request!', 400));
};

const validateUsers = async (req, res) => {
    setHeaders(res);

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
    
    const { validateBiospecimenUser } = require('./firestore');
    const email = decodedToken.email;
    const uid = decodedToken.uid;
    const isValidUser = await validateBiospecimenUser(email);
    if(!isValidUser) res.status(401).json(getResponseJSON('Authorization failed!', 401));
    const { assignCustomCLaims } = require('./firestore');
    assignCustomCLaims(uid, isValidUser);
    return res.status(200).json({data: {role: isValidUser}, code:200});
}

module.exports = {
    biospecimenAPIs
}