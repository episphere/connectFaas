const { getResponseJSON, setHeaders } = require('./shared');

const validate = async (req, res) => {
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        if(!req.headers.authorization || req.headers.authorization.trim() === ""){
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        else{
            let apiKey = req.headers.authorization.replace('Bearer','').trim();
            const { validateKey } = require(`./firestore`);
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
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const validateToken = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        if(req.query.token && req.query.token.trim() !== ""){
            const token = req.query.token;
            const { authorizeToken } = require('./firestore');
            const authorize = await authorizeToken(token, res);
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
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const getKey = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        const expires = new Date(Date.now() + 3600000);
        res.header('expires', expires);
        const uuid = require('uuid');
        const data = {
            apiKey: uuid(),
            token: uuid(),
            expires: expires
        }
        
        const { storeAPIKeyandToken } = require('./firestore');
        const response = await storeAPIKeyandToken(data);
        if(response instanceof Error){
            res.status(500).json(getResponseJSON(response.message, 500));
        }
        if(response){
            res.status(200).json({apiKey: data.apiKey, token: data.token, code: 200});
        }
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

module.exports = {
    validate,
    validateToken,
    getKey
}