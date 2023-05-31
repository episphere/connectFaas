const { getResponseJSON } = require('./shared');

const participantDataCleanupAPIs = async (req, res) => {
    const query = req.query;
    if (!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    console.log(api)

    if (api === 'destruction') {
        const { removeParticipantsDataDestruction } = require(`./firestore`);
        await removeParticipantsDataDestruction()
    }
    else if (api === 'uninvited') {
        const { removeUninvitedParticipants } = require(`./firestore`);
        await removeUninvitedParticipants()
    }
    else return res.status(400).json(getResponseJSON('Bad request!', 400));

    res.status(200).json({ message: 'Success!', code: 200 })
}

module.exports = {
    participantDataCleanupAPIs
}