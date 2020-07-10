const { getResponseJSON, setHeaders } = require('./shared');

const biospecimenAPIs = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    console.log(api)

    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    const decodedToken = await validateIDToken(idToken);
    
    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }
    
    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const { validateBiospecimenUser } = require('./firestore');
    const email = decodedToken.email;

    const isValidUser = await validateBiospecimenUser(email);
    if(!isValidUser) return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    const {role, siteCode} = isValidUser;
    
    if(api === 'getParticipants') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        if(req.query.type === 'filter') {
            const queries = req.query;
            delete queries.type;
            if(Object.keys(queries).length === 0) return res.status(404).json(getResponseJSON('Please include parameters to filter data.', 400));
            const { filterData } = require('./shared');
            const result = await filterData(queries, siteCode);
            if(result instanceof Error){
                return res.status(500).json(getResponseJSON(result.message, 500));
            }
            return res.status(200).json({data: result, code: 200})
        }
        else{
            return res.status(400).json(getResponseJSON('Bad request!', 400));
        }
    }
    else if(api === 'validateUsers') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        return res.status(200).json({data: {role}, code:200});
    }
    else if(api === 'users' && role === 'admin' || 'manager') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const { biospecimenUserList } = require('./firestore');
        const usersList = role === 'admin' ? await biospecimenUserList(siteCode) : await biospecimenUserList(siteCode, email);
        return res.status(200).json({data: {users: usersList}, code: 200})
    }
    else return res.status(400).json(getResponseJSON('Bad request!', 400));
};

module.exports = {
    biospecimenAPIs
}