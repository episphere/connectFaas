const { getResponseJSON, setHeaders } = require('./shared');

const submit = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'POST') {
        if(!req.headers.authorization || req.headers.authorization.trim() === ""){
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        else{
            const apiKey = req.headers.authorization.replace('Bearer','').trim();
            const { validateKey } = require(`./firestore`);
            const authorize = await validateKey(apiKey);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                let data = req.body;
                if(Object.keys(data).length > 0){
                    data.state_workflow = 1;
                    data.state_matched = 0;
                    if(!data.token){
                        const uuid = require('uuid');
                        data.token = uuid();
                    }
                    const { storeResponse } = require('./firestore');
                    const response = await storeResponse(data);
                    
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
};


module.exports = {
    submit
}