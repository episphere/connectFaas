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
    const data = req.body.data;
    if(Array.isArray(data)){ // Handle multiple objects in a Array
        if(data.length === undefined || data.length < 1) return res.status(400).json(getResponseJSON('data array doesn\'t have any element.', 400));

        if(data.length > 499) return res.status(400).json(getResponseJSON('More than acceptable limit of 500 records.', 400));
        const { errors, qcFailed } = await qcHandler(data);
        return res.status(200).json({errors, message: qcFailed ? 'Consistency check failed!' : 'Success!' , code: qcFailed ? 400 : 200});
    }
    else { // Handle single object
        if(Object.keys(data).length === 0) return res.status(400).json(getResponseJSON('data object doesn\'t have any attribute.', 400));
        const { errors, qcFailed } = await qcHandler(data, true);
        return res.status(200).json({errors, message: qcFailed ? 'Consistency check failed!' : 'Success!' , code: qcFailed ? 400 : 200});
    }
}

const qcHandler = async (data, handleObject) => {
    const qcRules = JSON.parse(await getData('https://episphere.github.io/connect/consistencyRules.json'));
    let qcFailed = false;
    const errors = [];
    if(handleObject) {
        if(!data['token']) return;
        let err = {};
        err['token'] = data['token'];
        let invalidSubmission = false
        for(let key in data) {
            if(qcRules[key]) {
                if(qcRules[key].dataType && qcRules[key].dataType !== typeof data[key]) {
                    if(err[key] === undefined) err[key] = {}
                    err[key].dataType = `Invalid data type, expected ${qcRules[key].dataType}`
                    invalidSubmission = true;
                    qcFailed = true;
                }
                const matches = qcRules[key].values.filter(e => e.toString() === data[key].toString());
                if(qcRules[key].values && matches.length === 0) {
                    if(err[key] === undefined) err[key] = {}
                    err[key].value = `${data[key]} is not a valid value!`
                    invalidSubmission = true;
                    qcFailed = true;
                }
            }
        }
        if(invalidSubmission) errors.push(err);
    }
    else {
        data.forEach(dt => {
            if(!dt['token']) return;
            let err = {};
            err['token'] = dt['token'];
            let invalidSubmission = false
            for(let key in dt) {
                if(qcRules[key]) {
                    if(qcRules[key].dataType && qcRules[key].dataType !== typeof dt[key]) {
                        if(err[key] === undefined) err[key] = {}
                        err[key].dataType = `Invalid data type, expected ${qcRules[key].dataType}`
                        invalidSubmission = true;
                        qcFailed = true;
                    }
                    
                    const matches = qcRules[key].values.filter(e => e.toString() === dt[key].toString());
                    if(qcRules[key].values && matches.length === 0) {
                        if(err[key] === undefined) err[key] = {}
                        err[key].value = `${dt[key]} is not a valid value!`
                        invalidSubmission = true;
                        qcFailed = true;
                    }
                }
            }
            if(invalidSubmission) errors.push(err);
        });
    }
    return {errors, qcFailed};
}

const getData = (url) => {
    const request = require('request');
    return new Promise((resolve, reject) => {
        request(url, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) reject('Invalid status code <' + response.statusCode + '>');
            resolve(body);
        });
    });
}

module.exports = {
    consistencyCheck
}