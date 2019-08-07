const { getResponseJSON, setHeaders } = require('./shared');

const submit = async (res, data) => {

    const hotProperties = Object.keys(data).filter(k => k.indexOf("state") === 0);
    hotProperties.forEach(key => delete data[key]);
    
    const { updateResponse } = require('./firestore');
    const response = await updateResponse(data);
    
    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    if(!response) {
        return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
    }
    return res.status(200).json(getResponseJSON('Data stored successfully!', 200));    
};

const recruitSubmit = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const access_token = req.headers.authorization.replace('Bearer','').trim();
    const { validateKey } = require(`./firestore`);
    const authorize = await validateKey(access_token);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    if(req.url.indexOf('/submit') !== -1){
        let data = req.body;
        if(Object.keys(data).length <= 0){
            return res.status(400).json(getResponseJSON('Bad request!', 400));
        }
        return submit(res, data)
    }
    else{
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
}

module.exports = {
    submit,
    recruitSubmit
}