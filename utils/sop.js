const { setHeaders, getResponseJSON, setHeadersDomainRestricted } = require('./shared');

const sop = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const { retrieveParticipantsDataDestruction } = require(`./firestore`);
    await retrieveParticipantsDataDestruction()

    return res.status(200).json({message: 'Success!', code: 200})
}

module.exports = {
    sop
}