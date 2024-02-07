const { getResponseJSON, setHeadersDomainRestricted, getUserProfile } = require('./shared');
const { recruitSubmit, submitSocial, getUserSurveys, getUserCollections } = require('./submission');
const { retrieveNotifications, sendMagicLink } = require('./notifications');
const { validateToken, generateToken, updateParticipantFirebaseAuthentication, validateUsersEmailPhone } = require('./validation');

const connectApp = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if (req.query.api === 'sendMagicLink') return sendMagicLink(req, res);

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

    console.log(`PWA API: ${api}, called from uid: ${uid}`);

  try {
    if (api === 'submit') return recruitSubmit(req, res, uid);

    if (api === 'submitSocial') return submitSocial(req, res, uid);

    else if (api === 'getUserProfile') return getUserProfile(req, res, uid);

    else if (api === 'getUserSurveys') return getUserSurveys(req, res, uid);

    else if (api === 'getUserCollections') return getUserCollections(req, res, uid);

    else if (api === 'retrieveNotifications') return retrieveNotifications(req, res, uid);
    
    else if (api === 'validateToken') return validateToken(req, res, uid);
    
    else if (api === 'generateToken') return generateToken(req, res, uid);

    else if (api === 'updateParticipantFirebaseAuthentication') return await updateParticipantFirebaseAuthentication(req, res);

    else if (api === 'validateEmailOrPhone') return validateUsersEmailPhone(req, res);

    else return res.status(400).json(getResponseJSON('Bad request!', 400));

  } catch (error) {
    console.error(error);
    return res.status(500).json(getResponseJSON(error.message, 500));
  }
}

module.exports = {
    connectApp
}