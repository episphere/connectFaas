exports.validate = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'GET') {
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
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};
 
exports.validateToken = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'GET') {
        if(req.query.token && req.query.token.trim() !== ""){
            const token = req.query.token;
            const { authorizeToken } = require('./utils/firestore');
            const authorize = await authorizeToken(token);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                res.status(200).json({data: authorize, code: 200});
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
}

exports.getKey = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'GET') {
        const { retrieveAPIKey } = require('./utils/firestore')
        const response = await retrieveAPIKey();
        if(response instanceof Error){
            res.status(500).json(getResponseJSON(response.message, 500));
        }
        if(response){
            res.status(200).json({apiKey: response, code: 200});
        }
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
}

exports.storeQuestionnaireResponse = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'POST') {
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
                let data = req.body;
                if(Object.keys(data).length > 0){
                    data.state = 1;
                    data.state_matched = 0;
                    let response;
                    if(data.token){
                        const { updateResponse } = require('./utils/firestore');
                        response = await updateResponse(data);
                    }
                    else {
                        const uuid = require('uuid');
                        data.token = uuid();
                        
                        const { storeResponse } = require('./utils/firestore');
                        response = await storeResponse(data);
                    }
                    
                    if(response instanceof Error){
                        res.status(500).json(getResponseJSON(response.message, 500));
                    }
                    if(response) {
                        res.status(200).json(getResponseJSON('Data stored successfully!', 200));
                    }
                    else{
                        res.status(500).json(getResponseJSON("Can't add/update data!", 500));
                    }
                }
                else{
                    res.status(400).json(getResponseJSON('Bad request!', 400));
                }
            }
            else{
                res.status(401).json(getResponseJSON('Authorization failed!', 401));
            }
        }   
    }
    else {
        res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
}

const getResponseJSON = (message, code) => {
    return { message, code };
}