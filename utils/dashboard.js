const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');

const dashboard = async (req, res) => {
    logIPAdddress(req);
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    const access_token = req.headers.authorization.replace('Bearer ','').trim();
    let siteDetails = '';
    
    const { SSOValidation } = require('./shared');
    siteDetails = await SSOValidation('siteManagerUser', access_token);

    if(!siteDetails) { // Temporary allowing used of siteKey to validate
        const { APIAuthorization } = require('./shared');
        siteDetails = await APIAuthorization(req);
    }
    if(!siteDetails) return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    const { isParentEntity } = require('./shared');
    const authObj = await isParentEntity(siteDetails);
    const isParent = authObj.isParent;
    const siteCodes = authObj.siteCodes;
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    console.log(api);
    if(api === 'validateSiteUsers') {
        const { validateSiteUsers } = require('./validation');
        return await validateSiteUsers(req, res, authObj);
    }
    else if (api === 'getParticipants') {
        const { getParticipants } = require('./submission');
        return await getParticipants(req, res, authObj);
    }
    else if (api === 'identifyParticipant' && isParent === false) {
        const { identifyParticipant } = require('./submission');
        return await identifyParticipant(req, res, siteCodes);
    }
    else if (api === 'submitParticipantsData') {
        const { submitParticipantsData } = require('./sites');
        return await submitParticipantsData(req, res, siteCodes);
    }
    else if (api === 'updateParticipantData') {
        const { updateParticipantData } = require('./sites');
        return await updateParticipantData(req, res, authObj);
    }
    else if (api === 'stats') {
        const { stats } = require('./stats');
        return await stats(req, res, authObj);
    }
    else if (api === 'getParticipantNotification') {
        const { getParticipantNotification } = require('./notifications');
        return await getParticipantNotification(req, res, authObj);
    }
    else if (api === 'storeNotificationSchema' && isParent && siteDetails.acronym === 'NCI') {
        const { storeNotificationSchema } = require('./notifications');
        return await storeNotificationSchema(req, res, authObj);
    }
    else if (api === 'retrieveNotificationSchema' && isParent && siteDetails.acronym === 'NCI') {
        const { retrieveNotificationSchema } = require('./notifications');
        return await retrieveNotificationSchema(req, res, authObj);
    }
    else return res.status(404).json(getResponseJSON('API not found!', 404));
}

module.exports = {
    dashboard
}