const { getResponseJSON, setHeadersDomainRestricted } = require('./shared');
const { recruitSubmit, getUserProfile, getUserCollections } = require('./submission');
const { retrieveNotifications } = require('./notifications');
const { validateToken, generateToken, validateUsersEmailPhone } = require('./validation');

const connectApp = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

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

    const uid = decodedToken.uid;

    const query = req.query;
    
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    
    const api = query.api;

    console.log(api);

    if (api === 'submit') return recruitSubmit(req, res, uid);

    else if (api === 'getUserProfile') return getUserProfile(req, res, uid);

    else if (api === 'getUserCollections') return getUserCollections(req, res, uid);

    else if (api === 'retrieveNotifications') return retrieveNotifications(req, res, uid);
    
    else if (api === 'validateToken') return validateToken(req, res, uid);
    
    else if (api === 'generateToken') return generateToken(req, res, uid);

    else if (api === 'validateEmailOrPhone') return validateUsersEmailPhone(req, res);

    else return res.status(400).json(getResponseJSON('Bad request!', 400));
}

module.exports = {
    connectApp
}