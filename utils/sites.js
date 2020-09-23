const { getResponseJSON, setHeaders } = require('./shared');

const getSiteDetails = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { retrieveSiteDetails } = require('./firestore');
    const response = await retrieveSiteDetails();

    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    if(response){
        return res.status(200).json({data: response, code:200})
    }   
}

const submitParticipantsData = async (req, res) => {
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    const body = req.body;
    if(Object.keys(body).length <= 0){
        console.log(`${siteKey} request body is empty.`)
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    console.log(`${siteKey} ${JSON.stringify(req.body)}`);

    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    const siteCode = authorize.siteCode;
    if(req.body.data === undefined) {
        console.log(`${siteKey} data is undefined in request body.`)
        return res.status(400).json(getResponseJSON('data is undefined in request body.', 400));
    }
    if(req.body.data.length === undefined || req.body.data.length < 1) {
        console.log(`${siteKey} data array doesn't have any element.`)
        return res.status(400).json(getResponseJSON('data array doesn\'t have any element.', 400));
    }

    if(req.body.data.length > 499) {
        console.log(`${siteKey} More than acceptable limit of 500 records.`)
        return res.status(400).json(getResponseJSON('More than acceptable limit of 500 records.', 400));
    }
    const data = req.body.data;
    console.log(`${siteKey} ${JSON.stringify(data)}`);

    for(let obj of data){
        if(obj.token){
            const participantToken = obj.token;
            const { getParticipantData } = require('./firestore');
            const record = await getParticipantData(participantToken, siteCode);
            if(record){
                const docID = record.id;
                delete obj.token;
                let newStateElements = {}
                for(let key in obj) {
                    if(record.data.state[key] === undefined){
                        newStateElements[`state.${key}`] = obj[key];
                    }
                }
                const { updateParticipantData } = require('./firestore');
                if(Object.keys(newStateElements).length > 0) updateParticipantData(docID, newStateElements);
            }
            else console.log(`${siteKey} Invalid token ${obj.token}`)
        }
        else console.log(`${siteKey} record doesn't contain any token ${JSON.stringify(obj)}`)
    }
    return res.status(200).json(getResponseJSON('Success!', 200));
}

const updateParticipantData = async (req, res) => {
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
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
    const siteCode = authorize.siteCode;
    console.log(req.body);
    if(req.body.data === undefined || Object.keys(req.body.data).length < 1 ) return res.status(400).json(getResponseJSON('Bad requuest.', 400));
    const dataObj = req.body.data;
    if(dataObj.token === undefined) return res.status(400).json(getResponseJSON('Invalid request, token missing.', 400));
    const participantToken = dataObj.token;
    const { getParticipantData } = require('./firestore');
    const record = await getParticipantData(participantToken, siteCode);
    if(!record) return res.status(400).json(getResponseJSON(`Invalid token ${participantToken}`, 400));
    const primaryIdentifiers = ['token', 'pin', 'Connect_ID', 'state.uid']
    const docID = record.id;
    const docData = record.data;
    console.log(docData)
    for(let key in dataObj) {
        if(key === 'state') continue;
        if(docData[key] === undefined) continue;
        if(primaryIdentifiers.indexOf(key) !== -1) continue;
        docData[key] = dataObj[key];
    }
    if(dataObj['state']) {
        for(let nestedKey in dataObj['state']) {
            if(docData['state'][nestedKey] === undefined) continue;
            if(primaryIdentifiers.indexOf(`state.${nestedKey}`) !== -1) continue;
            docData['state'][nestedKey] = dataObj['state'][nestedKey];
        }
    }
    console.log(docData)
    return res.status(200).json(getResponseJSON('Success!', 200));
}

module.exports = {
    getSiteDetails,
    submitParticipantsData,
    updateParticipantData
}