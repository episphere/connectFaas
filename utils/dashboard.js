const { getResponseJSON } = require('./shared');

const dashboard = async (req, res) => {
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    const access_token = req.headers.authorization.replace('Bearer ','').trim();
    const { SSOValidation } = require('./shared');
    const siteDetails = await SSOValidation('siteManagerUser', access_token);
    if(!siteDetails) return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    const { isParentEntity } = require('./shared');
    const authObj = await isParentEntity(siteDetails);
    
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    switch (api) {
        case 'validateSiteUsers': 
            break;
        case 'getParticipants':
            break;
        case 'identifyParticipant':
            break;
        case 'submitParticipantsData':
            break;
        case 'updateParticipantData':
            break;
        case 'stats':
            const { stats } = require('./stats');
            return await stats(req, res, authObj);
        default: 
            return res.status(404).json(getResponseJSON('API not found!', 404));
    }
}

module.exports = {
    dashboard
}