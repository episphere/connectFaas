const { getResponseJSON, setHeaders } = require('./shared');

const submitParticipantsData = async (req, res, site) => {
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    let siteCode = '';
    if(site) {
        siteCode = site;
    }
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        siteCode = authorized.siteCode;
    }

    if(req.body.data === undefined) return res.status(400).json(getResponseJSON('data is undefined in request body.', 400));
    if(req.body.data.length === undefined || req.body.data.length < 1) return res.status(400).json(getResponseJSON('data array doesn\'t have any element.', 400));

    if(req.body.data.length > 499) return res.status(400).json(getResponseJSON('More than acceptable limit of 500 records.', 400));

    const data = req.body.data;
    console.log(`${JSON.stringify(data)}`);
    let error = false;
    let errorMsgs = [];
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
                // Make participant active if Study invitaion is sent out.
                if(obj['934298480'] && record.data['512820379'] !== 854703046) { // If age deidentified data is provided and participant is not passive then make this participant Active
                    newStateElements['512820379'] = 486306141;
                    newStateElements['471593703'] = new Date().toISOString();
                }
                const { updateParticipantData } = require('./firestore');
                if(Object.keys(newStateElements).length > 0) updateParticipantData(docID, newStateElements);
            }
            else {
                console.log(`Invalid token ${obj.token}`)
                error = true;
                errorMsgs.push({token: participantToken, message: 'Invalid token!', code: 404});
            }
        }
        else {
            console.log(`Record doesn't contain any token ${JSON.stringify(obj)}`)
            error = true;
            errorMsgs.push({...obj, message: 'token missing!', code: 400});
        }
    }
    if(error) return res.status(206).json({code: 206, errorMsgs})
    else return res.status(200).json(getResponseJSON('Success!', 200));
}

const updateParticipantData = async (req, res, site) => {
    setHeaders(res);
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    let siteCode = '';
    if(site) {
        siteCode = site;
    }
    else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }

        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        siteCode = authorized.siteCode;
    }
    console.log(req.body);
    if(req.body.data === undefined || Object.keys(req.body.data).length < 1 ) return res.status(400).json(getResponseJSON('Bad requuest.', 400));
    const dataObj = req.body.data;
    console.log(`${JSON.stringify(dataObj)}`);
    if(dataObj.token === undefined) return res.status(400).json(getResponseJSON('Invalid request, token missing.', 400));
    const participantToken = dataObj.token;
    const { getParticipantData } = require('./firestore');
    const record = await getParticipantData(participantToken, siteCode);
    if(!record) return res.status(404).json(getResponseJSON(`Invalid token ${participantToken}`, 404));
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
    };
    const { updateParticipantData } = require('./firestore');
    updateParticipantData(docID, docData);
    return res.status(200).json(getResponseJSON('Success!', 200));
}

module.exports = {
    submitParticipantsData,
    updateParticipantData
}