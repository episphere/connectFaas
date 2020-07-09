const { getParticipants } = require("./submission");

const biospecimenAPIs = (req, res) => {
    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    if(api === 'getParticipants') return getParticipants(req, res);
    else return res.status(400).json(getResponseJSON('Bad request!', 400));
};

module.exports = {
    biospecimenAPIs
}