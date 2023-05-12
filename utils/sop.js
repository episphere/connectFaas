const { setHeaders, getResponseJSON, setHeadersDomainRestricted } = require('./shared');

const sop = async (req, res) => {
    setHeadersDomainRestricted(req, res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    // if(!req.headers.authorization || req.headers.authorization.trim() === ""){
    //     return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    // }

    // const idToken = req.headers.authorization.replace('Bearer','').trim();
    // const { validateIDToken } = require('./firestore');
    // const decodedToken = await validateIDToken(idToken);

    // if(decodedToken instanceof Error){
    //     return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    // }

    // if(!decodedToken){
    //     return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    // }

    const { retrieveParticipantsDataDestruction } = require(`./firestore`);
    await retrieveParticipantsDataDestruction()

    return res.status(200).json({message: 'Success!', code: 200})
}

module.exports = {
    sop
}