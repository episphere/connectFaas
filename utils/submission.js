const { getResponseJSON, setHeaders, logIPAdddress } = require('./shared');
const fieldMapping = require('./fieldToConceptIdMapping');

const submit = async (res, data, uid) => {
    
    // Remove locked attributes.
    const { lockedAttributes } = require('./shared');
    lockedAttributes.forEach(atr => delete data[atr]);

    // generate Connect_ID if Consent form submitted
    if(data[919254129] !== undefined && data[919254129] === 353358909) {
        const { generateConnectID } = require('./shared');
        const { sanityCheckConnectID } = require('./firestore');
        let boo = false;
        let Connect_ID;
        while(boo === false){
            const ID = generateConnectID();
            const response = await sanityCheckConnectID(ID);
            if(response === true) {
                Connect_ID = ID;
                boo = true;
            }
        }
        data = {...data, Connect_ID}
    }

    let keys = Object.keys(data);

    // check if submitting survey
    if (keys.length === 1) {

        const { moduleConceptsToCollections } = require('./shared');

        let key = keys[0];
        let collection = moduleConceptsToCollections[key];

        if(collection) {
            let moduleData = data[key];
            return await submitSurvey(res, moduleData, collection, uid)
        }
    }

    const { cleanSurveyData } = require('./shared');
    data = cleanSurveyData(data);

    const { updateResponse } = require('./firestore');
    const response = await updateResponse(data, uid);

    if (response) {
        let moduleComplete = false;

        keys.forEach(key => {
            const { moduleStatusConcepts } = require('./shared');

            if (moduleStatusConcepts[key] && data[key] === 231311385) {
                moduleComplete = true;
            }
        })

        if(moduleComplete) {

            const { checkDerivedVariables } = require('./validation');
            const { getTokenForParticipant, retrieveUserProfile } = require('./firestore');

            const participant = await retrieveUserProfile(uid);
            const siteCode = participant['827220437'];
            const token = await getTokenForParticipant(uid);

            await checkDerivedVariables(token, siteCode);
        }
    }
    
    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    if(!response) {
        return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
    }
    return res.status(200).json(getResponseJSON('Data stored successfully!', 200));    
};

const submitSurvey = async (res, data, collection, uid) => {
           
    const { cleanSurveyData } = require('./shared'); 
    const { surveyExists } = require('./firestore'); 

    data = cleanSurveyData(data);

    let response;
    let doc = await surveyExists(collection, uid);

    if (doc) {
        const { updateSurvey } = require('./firestore'); 
        response = await updateSurvey(data, collection, doc);
    }
    else {
        const { retrieveConnectID, storeSurvey } = require('./firestore'); 
        
        let connectID = await retrieveConnectID(uid);

        if(connectID instanceof Error) {
            return res.status(500).json(getResponseJSON(connectID.message, 500));
        }
        
        data["Connect_ID"] = connectID;
        data["uid"] = uid;

        response = await storeSurvey(data, collection);
    }

    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }
    
    return res.status(200).json(getResponseJSON('Survey data stored successfully!', 200));
}

const recruitSubmit = async (req, res, uid) => {
    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const data = req.body;
    if(Object.keys(data).length <= 0){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    return await submit(res, data, uid);
}

const submitSocial = async (req, res, uid) => {
    
    if (req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const data = req.body;
    const ssnNineDigits = data['ssnNineDigits'];
    const ssnFourDigits = data['ssnFourDigits'];

    if (Object.keys(data).length <= 0 || (!ssnNineDigits && !ssnFourDigits)){
        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }

    delete data['ssnNineDigits'];
    delete data['ssnFourDigits'];

    const { encryptAsymmetric } = require('./encrypt');
    const { getTokenForParticipant, storeSSN } = require('./firestore');

    const ssnObj = {};

    ssnNineDigits ? ssnObj[fieldMapping.ssnFullValue] = await encryptAsymmetric(ssnNineDigits.replace(/-/g, '')) : null;
    ssnFourDigits ? ssnObj[fieldMapping.ssnPartialValue] = await encryptAsymmetric(ssnFourDigits.replace(/-/g, '')) : null;

    ssnObj[fieldMapping.ssnQcStatus] = fieldMapping.ssnNoCheckRan;
    ssnObj['uid'] = uid;
    ssnObj['token'] = await getTokenForParticipant(uid);

    try {
        const response = await storeSSN(ssnObj);

        if(!response) {
            return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
        }
    }
    catch (error) {
        return res.status(500).json(getResponseJSON(error.message, 500));
    }

    if (ssnNineDigits) {
        data[fieldMapping.ssnFullGiven] = 353358909;
        data[fieldMapping.ssnFullGivenTime] = new Date().toISOString();
    
    }

    if (ssnFourDigits) {
        data[fieldMapping.ssnPartialGiven] = 353358909;
        data[fieldMapping.ssnPartialGivenTime] = new Date().toISOString();
    }

    data[fieldMapping.ssnCompleteTs] = new Date().toISOString();
    data[fieldMapping.ssnStatusFlag] = 231311385;

    
    try {
        const { updateResponse } = require('./firestore');
        const response = await updateResponse(data, uid);

        if (!response) {
            return res.status(500).json(getResponseJSON("Can't add/update data!", 500));
        }

        return res.status(200).json(getResponseJSON('Data stored successfully!', 200));
    }
    catch (error) {
        return res.status(500).json(getResponseJSON(error.message, 500));
    }
}

const getParticipants = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    let obj = {};
    if(authObj) {
        obj = authObj;
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
    
        const { isParentEntity } = require('./shared');
        obj = await isParentEntity(authorized);
    }
    
    const isParent = obj.isParent;
    const siteCodes = obj.siteCodes;

    if(!req.query.type) return res.status(404).json(getResponseJSON('Resource not found', 404));

    if(req.query.limit && parseInt(req.query.limit) > 1000) return res.status(400).json(getResponseJSON('Bad request, the limit cannot exceed more than 1000 records!', 400));

    let queryType = '';
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const page = req.query.page ? parseInt(req.query.page) : 1;

    const { getRestrictedFields } = require('./firestore')
    const restriectedFields = await getRestrictedFields();

    if (req.query.type === 'verified') queryType = req.query.type;
    else if (req.query.type === 'notyetverified') queryType = req.query.type;
    else if (req.query.type === 'cannotbeverified') queryType = req.query.type;
    else if (req.query.type === 'profileNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'consentNotSubmitted') queryType = req.query.type;
    else if (req.query.type === 'notSignedIn') queryType = req.query.type;
    else if (req.query.type === 'all') queryType = req.query.type;
    else if (req.query.type === 'active') queryType = req.query.type;
    else if (req.query.type === 'notactive') queryType = req.query.type;
    else if (req.query.type === 'passive') queryType = req.query.type;
    else if (req.query.type === 'individual'){
        if (req.query.token) {
            queryType = "individual";
            const { individualParticipant } = require(`./firestore`);
            let response = await individualParticipant('token', req.query.token, siteCodes, isParent);
            if(!response) return res.status(404).json(getResponseJSON('Resource not found', 404));
            if(response instanceof Error) res.status(500).json(getResponseJSON(response.message, 500));
            if(response.length > 0) response = removeRestrictedFields(response, restriectedFields, isParent);
            if(response) return res.status(200).json({data: response, code: 200})
        }
        else{
            return res.status(400).json(getResponseJSON('Bad request', 400));
        }
    }
    else if(req.query.type === 'filter') {
        const filterDeprecationWarning = "IMPORTANT: this type == 'filter' API is deprecated. Please use the new 'getFilteredParticipants' API. " + 
            "Ex: .../getFilteredParticipants?firstName=John&lastName=Doe | API notes & documentation: https://github.com/episphere/connect/issues/817#issuecomment-1883893946";
        const queries = req.query;
        delete queries.type;
        if(Object.keys(queries).length === 0) return res.status(400).json(getResponseJSON(`Please include parameters to filter data. ${filterDeprecationWarning}`, 400));
        const { filterData } = require('./shared');
        let result = await filterData(queries, siteCodes, isParent);
        if(result instanceof Error){
            return res.status(500).json(getResponseJSON(`${filterDeprecationWarning} ${result.message}`, 500));
        }
        // Remove module data from participant records.
        if(result.length > 0) result = removeRestrictedFields(result, restriectedFields, isParent);
        
        return res.status(200).json({data: result, message: filterDeprecationWarning, code: 200})
    }
    else if (req.query.type === 'refusalswithdrawals') {
        
        const { refusalWithdrawalConcepts } = require('./shared');

        let concept;

        if(req.query.option) {
            if(refusalWithdrawalConcepts[req.query.option]) {
                concept = refusalWithdrawalConcepts[req.query.option];
            }
            else {
                return res.status(400).json(getResponseJSON('Bad request', 400));
            }
        }
        else {
            concept = refusalWithdrawalConcepts.anyRefusalWithdrawal;
        }

        const { retrieveRefusalWithdrawalParticipants } = require('./firestore');
        let result = await retrieveRefusalWithdrawalParticipants(siteCodes, isParent, concept, limit, page);

        if(result instanceof Error){
            return res.status(400).json(getResponseJSON(result.message, 400));
        }

        return res.status(200).json({data: result, code: 200, limit, dataSize: result.length});
    }
    else{
        return res.status(404).json(getResponseJSON('Resource not found', 404));
    }
    const { retrieveParticipants } = require(`./firestore`);
    const site = isParent && req.query.siteCode && siteCodes.includes(parseInt(req.query.siteCode)) ? parseInt(req.query.siteCode) : null;
    if(site) console.log(`Retrieving data for siteCode - ${site}`);
    const from = req.query.from ? req.query.from : null; 
    const to = req.query.to ? req.query.to : null; 
    let data = await retrieveParticipants(siteCodes, queryType, isParent, limit, page, site, from, to);
    if(data instanceof Error){
        return res.status(500).json(getResponseJSON(data.message, 500));
    }
    
    // Remove module data from participant records.
    if(data.length > 0) data = await removeRestrictedFields(data, restriectedFields, isParent);
    return res.status(200).json({data, code: 200, limit, dataSize: data.length})
}

const removeRestrictedFields = (data, restriectedFields, isParent) => {
    if(restriectedFields && !isParent) {
        return data.filter(dt => {
            restriectedFields.forEach(field => delete dt[field]);
            return dt;
        })
    }
    else return data;
}

/**
 * Get participants based on the provided query parameters. Supports filtering by 'firstName', 'lastName', 'email', 'phone', 'dob', 'connectId', 'token', 'studyId', 'checkedIn'.
 * selectedFields is an optional array of concept IDs that limits returned data to the specified concept IDs. Nested data can be quieried with dot notation. Data nested under selectedField is returned.
 * Ex: 'selectedFields=399159511,996038075' returns firstName & lastName. Connect ID is always returned.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {object} authObj - Optional. Provided on access from SMDB or Biospecimen. If provided, the requester is a parent entity and the authObj contains the site codes.
 * @returns {array<object>} - A filtered array of participant data objects.
 */
const getFilteredParticipants = async (req, res, authObj) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    if(req.method !== 'GET') return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));

    let obj = {};
    if(authObj) {
        obj = authObj;
    } else {
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(500).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    
        const { isParentEntity } = require('./shared');
        obj = await isParentEntity(authorized);
    }
    const isParent = obj.isParent;
    const siteCodes = obj.siteCodes;
    
    if (req.query.type) return res.status(404).json(getResponseJSON(`The 'type' parameter is not used in this API. ${helpMessage}`, 400));
    if (req.query.limit && parseInt(req.query.limit) > 1000) return res.status(400).json(getResponseJSON('Bad request, the limit cannot exceed more than 1000 records!', 400));

    const filterableParams = ['firstName', 'lastName', 'email', 'phone', 'dob', 'connectId', 'token', 'studyId', 'checkedIn'];
    const helpMessage = "Filterable params include: 'firstName', 'lastName', 'email', 'phone', 'dob', 'connectId', 'token', 'studyId', and 'checkedIn'. The optional 'selectedFields' " +
    "param narrows results to specific fields. Omit selectedFields to return all data. Use dot notation to query nested data with selectedFields. Ex: 'selectedFields=399159511,996038075,130371375.266600170' " +
    "returns firstName, lastName, and data nested in payment round -> baseline. Connect ID is always returned. Typos are ignored. | API notes & documentation: https://github.com/episphere/connect/issues/817#issuecomment-1883893946"

    const queries = req.query;

    // Separate selectedFields from filter queries. These are handled separately, after the fetch operation.
    let selectedFields = [];
    if (queries.selectedFields) {
        selectedFields = queries.selectedFields.split(',');
        delete queries.selectedFields;
    }

    if (Object.keys(queries).length === 0) return res.status(400).json(getResponseJSON(`Please include parameters to filter data. ${helpMessage}`, 400));
    if (!Object.keys(queries).every(param => filterableParams.includes(param))) return res.status(400).json(getResponseJSON(`Invalid filter parameter. ${helpMessage}`, 400));

    // Future extension: the onlyActive and onlyVerified values may vary depending on the requester once integrated with SMDB and Biospecimen.
    queries['onlyVerified'] = true;
    queries['onlyActive'] = true;

    try {
        const { filterDB } = require('./firestore');
        const { filterSelectedFields } = require('./shared');

        let foundParticipantList = await filterDB(queries, siteCodes, isParent);

        if(foundParticipantList instanceof Error){
            return res.status(500).json(getResponseJSON(`${foundParticipantList.message} ${helpMessage}`, 500));
        }

        // Filter selected fields if selectedFields param is present. Otherwise, return all data.
        if(selectedFields.length > 0 && foundParticipantList.length > 0) {
            foundParticipantList = filterSelectedFields(foundParticipantList, selectedFields);
        }

        return res.status(200).json({data: foundParticipantList, code: 200});
    } catch (error) {
        return res.status(500).json({ data: [], message: `Error in getFilteredParticipants. ${error.message} | ${helpMessage}`, code: 500 });
    }
}

const identifyParticipant = async (req, res, site) => {
    logIPAdddress(req);
    setHeaders(res);
        
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    
    if(req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only GET or POST requests are accepted!', 405));
    }
    const verificationStatus = ['verified', 'cannotbeverified', 'duplicate', 'outreachtimedout'];
    if(req.method === 'GET') {

        if(!req.query.token || req.query.token.trim() === ""){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
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

        if(!req.query.type || req.query.type.trim() === ""){
            return res.status(400).json(getResponseJSON('Type is missing!', 400));
        }
        
        const type = req.query.type;
        const token = req.query.token;
        console.log(`identifyParticipant type: - ${type} and participant token: - ${token}`);

        if(verificationStatus.indexOf(type) === -1) return res.status(400).json(getResponseJSON('Type not supported!', 400));
        
        const { verifyIdentity } = require('./firestore');
        const identify = await verifyIdentity(type, token, siteCode);
        if(identify instanceof Error){
            return res.status(400).json(getResponseJSON(identify.message, 400));
        }

        if(identify){
            return res.status(200).json(getResponseJSON('Success!', 200));
        }
    }
    else if (req.method === 'POST') {
        if(req.body.data === undefined || req.body.data.length === 0 || req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request!', 400));
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

        const dataArray = req.body.data;
        console.log(dataArray)
        let error = false;
        let errorMsgs = [];
        for(let obj of dataArray) {
            if(obj.token && obj.type) { // If both token and type exists
                const type = obj.type;
                const token = obj.token;
                
                if(verificationStatus.indexOf(type) !== -1) {
                    const { verifyIdentity } = require('./firestore');
                    const identified = await verifyIdentity(type, token, siteCode);
                    if(identified instanceof Error) {
                        error = true;
                        errorMsgs.push({token, message: identified.message, code: 400});
                    }
                }
                else {
                    error = true;
                    errorMsgs.push({token, message: 'Type not supported!', code: 400});
                }
            }
            else {
                error = true;
                errorMsgs.push({...obj, message: 'Bad request!', code: 400});
            }
        }
        if(error) return res.status(206).json({code: 206, errorMsgs})
        else return res.status(200).json(getResponseJSON('Success!', 200));
    }
}

const getUserSurveys = async (req, res, uid) => {

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const concepts = req.body;

    const { retrieveUserSurveys } = require('./firestore'); 
    const response = await retrieveUserSurveys(uid, concepts); //add parameter for modules

    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    // build response object

    return res.status(200).json({data: response, code:200});

}

const getUserCollections = async (req, res, uid) => {

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    
    const { getSpecimenCollections, getTokenForParticipant, retrieveUserProfile } = require('./firestore');
    const { isEmpty } = require('./shared');
    
    const participant = await retrieveUserProfile(uid);

    // handle errors and undefined siteCode
    if (participant instanceof Error || isEmpty(participant)) {
        return res.status(404).json(getResponseJSON('Data not found!', 404));
    }

    const siteCode = participant['827220437'];
    const token = await getTokenForParticipant(uid);

    try {
      const specimenArray = await getSpecimenCollections(token, siteCode);
      return res.status(200).json({ data: specimenArray, message: 'Success!', code: 200 });
    } catch (error) {
      console.error('Error occurred when running getSpecimenCollections:', error);
    return res.status(500).json({ data: [], message: 'Error occurred when running getSpecimenCollections.', code: 500 });
    }
}

/**
 * Get the sha of a module in the questionnaire repository.
 * @param {string} path - the path to the module in the questionnaire repository.
 * @returns {string} - the sha of the module.
 */
const getModuleSHA = async (path) => {
    try {
        const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
        const client = new SecretManagerServiceClient();
        const [version] = await client.accessSecretVersion({ name: process.env.GITHUB_TOKEN });
        const token = version.payload.data.toString();

        const gitHubApiResponse = await fetch(`https://api.github.com/repos/episphere/questionnaire/commits?path=${path}&sha=main&per_page=1`, {
            headers: {
                'Authorization': `token ${token}`,
            }
        });

        const rateLimitRemaining = gitHubApiResponse.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
            console.error('GitHub API rate limit exceeded.');
            throw new Error('GitHub API rate limit exceeded.');
        }

        const responseJSON = await gitHubApiResponse.json();

        const sha = responseJSON[0]?.sha;

        if (!sha) {
            console.error('Error: Module SHA not found:');
            throw new Error(`Error: Module SHA not found for path ${path}:`, path, responseJSON);
        }
        
        return responseJSON[0].sha;

    } catch (error) {
        console.error('Error fetching module SHA:', error);
        throw new Error("Error fetching module SHA.", { cause: error });
    }
}

module.exports = {
    submit,
    recruitSubmit,
    submitSocial,
    getFilteredParticipants,
    getParticipants,
    identifyParticipant,
    getUserSurveys,
    getUserCollections,
    getModuleSHA,
}