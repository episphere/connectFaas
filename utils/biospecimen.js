const { getResponseJSON, setHeaders } = require('./shared');

const biospecimenAPIs = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const api = query.api;
    console.log(api)

    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    const decodedToken = await validateIDToken(idToken);
    
    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }
    
    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const { validateBiospecimenUser } = require('./firestore');
    const email = decodedToken.email;
    console.log(email);

    const isValidUser = await validateBiospecimenUser(email);
    if(!isValidUser) return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    const {role, siteCode, siteAcronym} = isValidUser;
    
    if(api === 'getParticipants') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        if(req.query.type === 'filter') {
            const queries = req.query;
            delete queries.type;
            if(Object.keys(queries).length === 0) return res.status(404).json(getResponseJSON('Please include parameters to filter data.', 400));
            const { filterData } = require('./shared');
            const result = await filterData(queries, siteCode);
            if(result instanceof Error){
                return res.status(500).json(getResponseJSON(result.message, 500));
            }
            return res.status(200).json({data: result, code: 200})
        }
        else{
            return res.status(400).json(getResponseJSON('Bad request!', 400));
        }
    }
    else if(api === 'validateUsers') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        return res.status(200).json({data: {role, siteAcronym, siteCode}, code:200});
    }
    else if(api === 'users' && (role === 'admin' || role === 'manager')) {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const { biospecimenUserList } = require('./firestore');
        const usersList = role === 'admin' ? await biospecimenUserList(siteCode) : await biospecimenUserList(siteCode, email);
        return res.status(200).json({data: {users: usersList}, code: 200})
    }
    else if(api === 'addUsers' && (role === 'admin' || role === 'manager')) {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        console.log(requestData);
        if(requestData.length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        for(let person of requestData) {
            if(person.name && person.email && person.role){
                if(role === 'admin' && ( person.role === 'manager' || person.role === 'user')){
                    const response = await addNewUser(person, email, siteCode);
                    if(response instanceof Error){
                        return res.status(400).json(getResponseJSON(response.message, 400));
                    }
                }
                if(role === 'manager' && person.role === 'user'){
                    const response = await addNewUser(person, email, siteCode);
                    if(response instanceof Error){
                        return res.status(400).json(getResponseJSON(response.message, 400));
                    }
                }
            }
        }
        return res.status(200).json({message: 'Success!', code: 200})
    }
    else if (api === 'removeUser'  && (role === 'admin' || role === 'manager')) {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const emailId = req.query.email;
        if(!emailId) return res.status(400).json(getResponseJSON('Query parameter email is missing.', 400));
        if(emailId === email) return res.status(400).json(getResponseJSON('Can not remove yourself.', 400));
        const { removeUser } = require('./firestore');
        let response = '';
        if(role === 'admin') response = await removeUser(emailId, siteCode, email);
        else if(role === 'manager') response = await removeUser(emailId, siteCode, email, true);
        if(!response) return res.status(404).json(getResponseJSON('User not found.', 404));
        return res.status(200).json({message: 'Success!', code:200})
    }
    else if (api === 'addSpecimen') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(requestData.length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        for(let specimen of requestData) {
            if(specimen.masterSpecimenId){
                const masterSpecimenId = specimen.masterSpecimenId;
                const { specimenExists } = require('./firestore');
                const exists = await specimenExists(masterSpecimenId, specimen)
                if(exists === false){
                    const uuid = require('uuid');
                    specimen['id'] = uuid();
                    const { storeSpecimen } = require('./firestore');
                    await storeSpecimen(specimen);
                }
            }
            return res.status(200).json({message: 'Success!', code:200})
        }
    }
    else if (api === 'searchSpecimen') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        if(req.query.masterSpecimenId) {
            const masterSpecimenId = req.query.masterSpecimenId;
            if(!masterSpecimenId) return res.status(400).json(getResponseJSON('Bad request!', 400));
            const { searchSpecimen } = require('./firestore');
            const response = await searchSpecimen(masterSpecimenId, siteCode);
            if(!response) return res.status(404).json(getResponseJSON('Data not found!', 404));
            return res.status(200).json({data: response, code:200});
        }
        else {
            const { searchShipments } = require('./firestore');
            const response = await searchShipments(siteAcronym);
            return res.status(200).json({data: response, code:200});
        }
        
    }
    else if(api == 'addBox'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        
        if(requestData.boxId){
            const boxId = requestData.boxId;
            requestData['boxId'] = boxId;
            requestData['institute'] = siteAcronym; 
            const { boxExists } = require('./firestore');
            const exists = await boxExists(boxId, siteAcronym, requestData)
            if(exists === false){
                const { storeBox } = require('./firestore');
                
                await storeBox(requestData);
            }
        }
        return res.status(200).json({message: 'Success!', code:200})
    }
    else if (api === 'searchBoxes') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const { searchBoxes } = require('./firestore');
        const response = await searchBoxes(siteAcronym);
        return res.status(200).json({data: response, code:200});
        
    }
    else if(api == 'ship'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(requestData.length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        for(let box of requestData) {
            const { shipBox } = require('./firestore');
            const exists = await shipBox(box, siteAcronym, {'shipped':true})
            if(exists === false){
                return res.status(500).json({message: 'Box does not exist', code:500})
            }
        }
        return res.status(200).json({message: 'Success!', code:200})

    }
    else if (api === 'updateParticipantData') {
        const { updateParticipantData } = require('./sites');
        return updateParticipantData(req, res, siteCode)
    }
    else return res.status(400).json(getResponseJSON('Bad request!', 400));
};

const addNewUser = async (person, email, siteCode) => {
    const { biospecimenUserExists } = require('./firestore');
    const exists = await biospecimenUserExists(person.email);
    if(exists === false) {
        person['addedBy'] = email;
        person['addedAt'] = new Date().toISOString();
        person['siteCode'] = siteCode;
        const { addNewBiospecimenUser } = require('./firestore');
        await addNewBiospecimenUser(person);
    }
    else return new Error('User with this email already exists');
}

module.exports = {
    biospecimenAPIs
}