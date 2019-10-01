const { getResponseJSON, setHeaders } = require('./shared');

const validate = async (req, res) => {
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        if(!req.headers.authorization || req.headers.authorization.trim() === ""){
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        else{
            let access_token = req.headers.authorization.replace('Bearer','').trim();
            const { validateKey } = require(`./firestore`);
            const authorize = await validateKey(access_token);
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
            const authorize = await authorizeToken(token);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                res.header('expires', authorize.expires);
                res.header('Set-Cookie', `access_token=${authorize.access_token}; Expires=${authorize.expires}`)
                res.status(200).json({access_token: authorize.access_token, code: 200});
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
            access_token: uuid(),
            token: uuid(),
            expires: expires
        }
        
        const { storeAPIKeyandToken } = require('./firestore');
        const response = await storeAPIKeyandToken(data);
        if(response instanceof Error){
            return res.status(500).json(getResponseJSON(response.message, 500));
        }
        if(response){
            res.header('Set-Cookie', `access_token=${data.access_token}; Expires=${expires}`)
            return res.status(200).json({access_token: data.access_token, token: data.token, code: 200});
        }
    }
    else {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const validateSiteUsers = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    return res.status(200).json(getResponseJSON('Ok', 200));
}

module.exports = {
    validate,
    validateToken,
    getKey,
    validateSiteUsers
}
