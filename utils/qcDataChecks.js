const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');

const consistencyCheck = async (req, res) => {
    logIPAdddress(req);
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    
    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req);
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    const siteCode = authorized.siteCode;

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('data is undefined in request body.', 400));
    if(req.body.data.length === undefined || req.body.data.length < 1) return res.status(400).json(getResponseJSON('data array doesn\'t have any element.', 400));

    if(req.body.data.length > 499) return res.status(400).json(getResponseJSON('More than acceptable limit of 500 records.', 400));
    const data = req.body.data;
    const { errors, qcFailed } = qcHandler(data);
    return res.status(200).json({errors, message: qcFailed ? 'Failed!' : 'Success!' , code: qcFailed ? 400 : 200});
}

const qcHandler = (data) => {
    let qcFailed = false;
    const errors = [];
    const qcRules = require('./qcRules.json');
    data.forEach(dt => {
        if(!dt['token']) return;
        let err = {};
        err['token'] = dt['token'];
        let invalidSubmission = false
        for(let key in dt) {
            if(qcRules[key]) {
                if(qcRules[key].values && !qcRules[key].values.toString().includes(dt[key])) {
                    if(err[key] === undefined) err[key] = {}
                    err[key].value = `${dt[key]} is not a valid value!`
                    invalidSubmission = true;
                    qcFailed = true;
                }
                if(qcRules[key].dataType && qcRules[key].dataType !== typeof dt[key]) {
                    if(err[key] === undefined) err[key] = {}
                    err[key].dataType = `Invalid data type, expected ${qcRules[key].dataType}`
                    invalidSubmission = true;
                    qcFailed = true;
                }
            }
        }
        if(invalidSubmission) errors.push(err);
    });
    return {errors, qcFailed};
}

module.exports = {
    consistencyCheck
}