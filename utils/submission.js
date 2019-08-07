const { getResponseJSON, setHeaders } = require('./shared');

const submit = async (res, data) => {
    let sourceExists = false;
    if(data.source && data.source === 'eligibility_screener'){
        delete data.source;
        sourceExists = true;
        data.state_workflow = 1;
        data.state_matched = 0;
        data.RcrtES_Eligible_v1r0 = data.RcrtES_AgeQualify_v1r0 == 1 && data.RcrtES_CancerHist_v1r0 == 0 && data.RcrtES_Site_v1r0 != 88 ? 1 : 0;
    }
    
    const { storeResponse } = require('./firestore');
    const response = await storeResponse(data);
    
    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    if(!response) {
        return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
    }

    if(sourceExists){
        return res.status(200).json({
            message: 'Data stored successfully!',
            eligibility: data.RcrtES_Eligible_v1r0 === 1 ? true : false,
            code: 200
        });
    }
    else {
        return res.status(200).json(getResponseJSON('Data stored successfully!', 200));
    }
    
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