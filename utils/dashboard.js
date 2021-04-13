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
    const isParent = authObj.isParent;
    const siteCodes = authObj.siteCodes;
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;

    if(api === 'validateSiteUsers') {

    }
    else if (api === 'getParticipants') {

    }
    else if (api === 'identifyParticipant') {

    }
    else if (api === 'submitParticipantsData') {

    }
    else if (api === 'updateParticipantData' && isParent === false) {
        const { updateParticipantData } = require('./sites');
        return await updateParticipantData(req, res, siteCodes);
    }
    else if (api === 'stats') {
        const { stats } = require('./stats');
        return await stats(req, res, authObj);
    }
    else return res.status(404).json(getResponseJSON('API not found!', 404));
}

module.exports = {
    dashboard
}