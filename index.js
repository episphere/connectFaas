exports.validate = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
       res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    else{
        let apiKey = req.headers.authorization.replace('Bearer','').trim();
        const { validateKey } = require(`./utils/firestore`);
        const authorize = await validateKey(apiKey);
        if(authorize instanceof Error){
            res.status(500).json(getResponseJSON(authorize.message, 500));
        }
        if(authorize){
            res.status(200).json(getResponseJSON('Success!', 200));
        }
        else{
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    }
};
 
exports.validateToken = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    if(req.query.token && req.query.token.trim() !== ""){
        const token = req.query.token;
        const { authorizeToken } = require('./utils/firestore');
        const authorize = await authorizeToken(token);
        if(authorize instanceof Error){
            res.status(500).json(getResponseJSON(authorize.message, 500));
        }
        if(authorize){
            res.status(200).json({apiKey: authorize, code: 200});
        }
        else{
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    }else{
        res.status(406).json(getResponseJSON('Token missing!', 406));
    }
}

exports.storeQuestionnaireResponse = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    let data = JSON.parse(req.body);
    if(!data.token){
        const uuid = require('uuid');
        data.token = uuid();
        data.tokenVerified = "no";
    }
    const { storeResponse } = require('./utils/firestore');
    const response = await storeResponse(data);
    if(response instanceof Error){
        res.status(500).json(getResponseJSON(response.message, 500));
    }
    else {
        res.status(200).json(getResponseJSON('Document added!', 200));
    }
    
}

const getResponseJSON = (message, code) => {
    return { message, code };
}