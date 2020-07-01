const { getResponseJSON } = require('./shared');
const { recruitSubmit, getUserProfile } = require('./submission');
const { subscribeToNotification, retrieveNotifications } = require('./notifications');
const { validateToken, generateToken } = require('./validation');

const connectApp = (req, res) => {
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    if (api === 'submit') return recruitSubmit(req, res);
    else if (api === 'getUserProfile') return getUserProfile(req, res);
    else if (api === 'subscribeToNotification') return subscribeToNotification(req, res);
    else if (api === 'retrieveNotifications') return retrieveNotifications(req, res);
    else if (api === 'validateToken') return validateToken(req, res);
    else if (api === 'generateToken') return generateToken(req, res);
    else return res.status(400).json(getResponseJSON('Bad request!', 400));
}

module.exports = {
    connectApp
}