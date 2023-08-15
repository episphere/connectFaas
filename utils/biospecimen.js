const { getResponseJSON, setHeaders, logIPAdddress, SSOValidation, convertSiteLoginToNumber } = require('./shared');

const biospecimenAPIs = async (req, res) => {
    logIPAdddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const query = req.query;
    if(!query.api) return res.status(400).json(getResponseJSON('Bad request!', 400));

    const api = query.api;
    console.log("API Accessed: Biospecimen - " + api);

    const idToken = req.headers.authorization.replace('Bearer','').trim();
    const { validateIDToken } = require('./firestore');
    let decodedToken = await SSOValidation('biospecimenUser', idToken) || await validateIDToken(idToken);

    if(decodedToken instanceof Error){
        return res.status(401).json(getResponseJSON(decodedToken.message, 401));
    }
    
    if(!decodedToken){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const email = decodedToken.email;
    console.log("Accessed By: " + email);

    const isBPTLUser = decodedToken.isBPTLUser !== undefined ? decodedToken.isBPTLUser : false;
    const isBiospecimenUser = decodedToken.isBiospecimenUser !== undefined ? decodedToken.isBiospecimenUser : false;

    let obj = {};
    let role = "";
    let siteAcronym = "";
    let siteCode = undefined;

    if(!isBPTLUser && !isBiospecimenUser) {
        const { validateBiospecimenUser } = require('./firestore');
        const isValidUser = await validateBiospecimenUser(email);
        if(!isValidUser) return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        role = isValidUser.role;
        siteCode = isValidUser.siteCode;
        siteAcronym = isValidUser.siteAcronym;
        obj = { role, siteCode,siteAcronym, isBPTLUser, isBiospecimenUser, email };
    }
    else {
        role = 'user';
        siteCode = decodedToken.siteDetails.siteCode ? decodedToken.siteDetails.siteCode : 13;
        siteAcronym = decodedToken.siteDetails.acronym;
        obj = { role, siteAcronym, isBPTLUser, isBiospecimenUser, email };
        if(siteCode !== 0) obj['siteCode'] = siteCode;
    }
    
    
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
        return res.status(200).json({data: obj, code:200});
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
            if(specimen['820476880']){
                const masterSpecimenId = specimen['820476880'];
                const { specimenExists } = require('./firestore');
                const exists = await specimenExists(masterSpecimenId, specimen)
                if(exists === true) return res.status(400).json(getResponseJSON('Specimen already exists!', 400));
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
    else if(api === 'accessionIdExists'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        if(requestData['accessionId']){
            const accessionId = requestData['accessionId'];
            const accessionIdType = requestData['accessionIdType'];
            const { accessionIdExists } = require('./firestore');
            const existingData = await accessionIdExists(accessionId, accessionIdType, siteCode);
            if (!!existingData) return res.status(200).json({message: 'AccessionId exists!', data: existingData, code:200})
        }
        return res.status(200).json(getResponseJSON('AccessionId doesn\'t exist!', 200));
    }
    else if (api === 'updateSpecimen') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(requestData.length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        for(let specimen of requestData) {
            if(specimen['820476880']){
                const masterSpecimenId = specimen['820476880'];
                const { specimenExists } = require('./firestore');
                const exists = await specimenExists(masterSpecimenId, specimen)
                if(exists === false) return res.status(400).json(getResponseJSON('Specimen does not exist!', 400));
                if(exists === true){
                    const { updateSpecimen } = require('./firestore');
                    await updateSpecimen(masterSpecimenId, specimen);
                    
                    return res.status(200).json({message: 'Success!', code:200});
                }
            }
            else {
                return res.status(400).json({message: 'Collection ID does not exist in the request body!', code:400});
            }
        }
    }
    else if (api === 'checkDerivedVariables') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }

        const requestData = req.body;
        if(requestData.length === 0 ) {
            return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        }

        const token = requestData.token;
        if(!token) {
            return res.status(400).json(getResponseJSON('Request body does not include token!', 400));
        }

        const { checkDerivedVariables } = require ('./validation');
        await checkDerivedVariables(token, siteCode);

        return res.status(200).json({message: 'Success!', code:200});
    }
    else if (api === 'searchSpecimen') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        if(req.query.masterSpecimenId) {
            const { searchSpecimen } = require('./firestore');
            const masterSpecimenId = req.query.masterSpecimenId;
            const allSitesFlag = (req.query.allSitesFlag) ? true : false;

            try {
              const biospecimenData = await searchSpecimen(masterSpecimenId, siteCode, allSitesFlag);
              return res.status(200).json({ data: biospecimenData, message: 'Success!', code: 200 });
            } catch (error) {
              console.error('Error occurred when running searchSpecimen:', error);
              return res.status(500).json({ data: {}, message: 'Error occurred when running searchSpecimen.', code: 500 });
            }
        }
        else {
            const { searchShipments } = require('./firestore');
            const requestedSite = convertSiteLoginToNumber(req.query.requestedSite);
            const response = requestedSite ? await searchShipments(requestedSite) : await searchShipments(siteCode);
            return res.status(200).json({data: response, code:200});
        }
        
    }
    else if(api === 'getParticipantCollections') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        if(req.query.token) {
            const { getSpecimenCollections } = require('./firestore');
            const token = req.query.token;

            try {
              const specimenArray = await getSpecimenCollections(token, siteCode);
              return res.status(200).json({ data: specimenArray, message: 'Success!', code: 200 });
            } catch (error) {
              console.error('Error occurred when running getSpecimenCollections:', error);
              return res.status(500).json({ data: [], message: 'Error occurred when running getSpecimenCollections.', code: 500 });
            }
        }

        return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    //TODO: remove this endpoint after Aug 2023 push. Verify addBoxAndUpdateSiteDetails is working as expected.
    else if(api == 'addBox'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        if(requestData['132929440']){
            const boxId = requestData['132929440'];
            const loginSite = requestData['789843387']
            const { boxExists } = require('./firestore');
            const exists = await boxExists(boxId, loginSite);
            if (exists === true) return res.status(200).json(getResponseJSON('Box already exists!', 200));
            if (exists === false) {
                const { addBox } = require('./firestore');
                await addBox(requestData);
            }
        }
        return res.status(200).json({message: 'Success!', code:200})
    }
    else if(api == 'addBoxAndUpdateSiteDetails'){
        try {
            if(req.method !== 'POST') {
                return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
            }
    
            const requestData = req.body;
            if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));

            const boxId = requestData['132929440'];
            const loginSite = requestData['789843387'];
    
            if (!boxId || !loginSite) {
                return res.status(400).json(getResponseJSON('Required fields are missing!', 400));
            }
    
            const { boxExists, addBoxAndUpdateSiteDetails } = require('./firestore');
            const exists = await boxExists(boxId, loginSite);
    
            if (exists === true) {
                return res.status(409).json(getResponseJSON('Conflict: Box already exists!', 409));
            } else if (exists === false) {
                await addBoxAndUpdateSiteDetails(requestData);
                return res.status(200).json({message: 'Success!', code:200});
            }
        } catch (error) {
            console.error("Error in addBoxAndUpdateSiteDetails endpoint:", error.message);
            return res.status(500).json(getResponseJSON('Internal Server Error', 500));
        }
    }
    else if(api == 'updateBox'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        
        if(requestData['132929440']){
            const boxId = requestData['132929440'];
            const loginSite = requestData['789843387']
            const { boxExists } = require('./firestore');
            const exists = await boxExists(boxId, loginSite, requestData);
            if (exists === false) return res.status(400).json(getResponseJSON('Box does not exist!', 400));
            if (exists === true) {
                const { updateBox } = require('./firestore');
                await updateBox(boxId, requestData, loginSite);
                return res.status(200).json({message: 'Success!', code:200})
            }
        } else {
            return res.status(400).json({message: 'Error!', code:400});
        }
    }
    else if (api === 'searchBoxes') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
            const { searchBoxes } = require('./firestore');
            const response = await searchBoxes(siteCode, req.query.source === `bptl` ? `bptl` : ``);
            return res.status(200).json({data: response, code:200});
    }
    else if (api === 'searchBoxesByLocation'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        let location = req.body.location;
        console.log(location);
        const { searchBoxesByLocation } = require('./firestore');
        const response = await searchBoxesByLocation(siteCode, location);
        return res.status(200).json({data: response, code:200});
    }
    else if(api === 'ship'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }

        const boxIdToTrackingNumberMap = req.body.boxIdToTrackingNumberMap;
        const shippingData = req.body.shippingData;
        if (!boxIdToTrackingNumberMap || !shippingData) {
          return res
            .status(400)
            .json(getResponseJSON('Request data is incomplete!', 400));
        }

        const requiredKeysInShippingdData = ['666553960', '948887825'];
        for (const key of requiredKeysInShippingdData) {
          if (!shippingData[key]) {
            return res
              .status(400)
              .json(getResponseJSON(`Required key ${key} is missing in shipping data!`,400));
          }
        }

        const boxIdArray = Object.keys(boxIdToTrackingNumberMap);
        if (boxIdArray.length === 0 ) {
          return res.status(400).json(getResponseJSON('No box data found in request!', 400));
        }
        
        const { shipBatchBoxes} = require('./firestore');
        
        let {boxWithTempMonitor, ...sharedShipmentData} = shippingData;
        
        sharedShipmentData = {
          ...sharedShipmentData,
          656548982: new Date().toISOString(),
          145971562: 353358909,
          105891443: 104430631,
        };

        let boxIdAndShipmentDataArray = [];

        for (const boxId of boxIdArray) {
          let shipmentData = {
            ...sharedShipmentData,
            959708259: boxIdToTrackingNumberMap[boxId],
          };

          if (boxWithTempMonitor === boxId) {
            shipmentData['105891443'] = 353358909;
          }

          boxIdAndShipmentDataArray.push({boxId, shipmentData});
        }

        try {
          const isShipmentSuccessful = await shipBatchBoxes(boxIdAndShipmentDataArray, siteCode);
          if (!isShipmentSuccessful) {
            return res.status(500).json({ message: 'Failed to save box data', code: 500 });
          }
          return res.status(200).json({ message: 'Success!', code: 200 });
        } catch (error) {
          console.log("Error occurred when running shipBatchBoxes():\n", error);
          return res.status(500).json({ message: 'Internal Server Error', code: 500 });
        }
        
    }
    else if (api === 'updateParticipantData') {
        const { updateParticipantData } = require('./sites');
        return updateParticipantData(req, res, siteCode)
    }
    else if (api === 'updateParticipantDataNotSite') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        
        const {submit} = require('./submission');
        let body = req.body;
        if(!body.uid) {
            return res.status(500).json(getResponseJSON('Missing UID!', 405));
        }
        let uid = body.uid;
        delete body['uid']
        return submit(res, body, uid)
    }
    else if (api === 'getUserProfile') {

        const { getUserProfile } = require('./shared');

        if(query.uid) {
            return getUserProfile(req, res, query.uid);
        }
        else return res.status(400).json(getResponseJSON('Bad request!', 400));
    }
    else if (api === 'removeBag') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const {removeBag} = require('./firestore');
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));

        await removeBag(siteCode, requestData);
        return res.status(200).json({message: 'Success!', code:200});
    }
    else if (api === 'reportMissingSpecimen'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const {reportMissingSpecimen} = require('./firestore');
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));

        await reportMissingSpecimen(siteAcronym, requestData);
        return res.status(200).json({message: 'Success!', code:200});
 

    }
    else if (api === 'getLocations'){
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const {getLocations} = require('./firestore');
        const response = await getLocations(siteAcronym);
        return res.status(200).json({message: 'Success!', response, code:200});
    }
    else if (api === 'updateTempCheckDate'){
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const {updateTempCheckDate} = require('./firestore');
        await updateTempCheckDate(siteAcronym);
        return res.status(200).json({message: 'Success!', code:200});
    }
    else if (api === 'getBoxesPagination'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const {getBoxesPagination} = require('./firestore');
        const requestData = req.body;
        let toReturn = await getBoxesPagination(siteCode, requestData);
        return res.status(200).json({data: toReturn, code:200});
    }
    else if(api === 'getNumBoxesShipped'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const {getNumBoxesShipped} = require('./firestore');
        const requestData = req.body;
        let response = await getNumBoxesShipped(siteCode, requestData);
        return res.status(200).json({data:response, code:200});
    }

    else if(api == 'addKitData'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        const requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        const uuid = require('uuid');
        const currentDate = new Date().toISOString();
        requestData.id = uuid();
        requestData.timeStamp = currentDate;
        const { addKitAssemblyData } = require('./firestore');
        const response = await addKitAssemblyData(requestData);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({message: `Success!`, code:200})
    }

    else if(api == 'getKitData'){
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const { getKitAssemblyData } = require('./firestore');
        const response = await getKitAssemblyData();
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({data: response, code:200})
    }

     // Participant Selection with filter GET- BPTL 
    else if(api === 'getParticipantSelection') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const query = req.query.type;
        if(Object.keys(query).length === 0) return res.status(404).json(getResponseJSON('Please include parameter to filter data.', 400));
        const { getParticipantSelection } = require('./firestore');
        const response = await getParticipantSelection(query);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        console.log('res', response)
        return res.status(200).json({data: response, code:200})
    }

    else if(api === 'getSiteMostRecentBoxId'){
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        try {
            const {getSiteMostRecentBoxId} = require('./firestore');
            const response = await getSiteMostRecentBoxId(siteCode);
            if(!response) {
                return res.status(404).json(getResponseJSON('No matching document found!', 404));
            }
            return res.status(200).json({data: response, code: 200});
        } catch (error) {
            console.error("Error fetching site most recent box ID:", error);
            return res.status(500).json(getResponseJSON('Internal Server Error', 500));
        }
    }
     // Print Addresses POST- BPTL
    else if(api == 'printAddresses'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        let requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        const { addPrintAddressesParticipants } = require('./firestore');
        const response = await addPrintAddressesParticipants(requestData);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({message: `Success!`, code:200})
    }

    // Print Addresses POST- BPTL
    else if(api == 'assignKit'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        let requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        const { assignKitToParticipants } = require('./firestore');
        const response = await assignKitToParticipants(requestData);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({message: `Success!`, code:200})
    }

        // Shipped POST- BPTL
    else if(api == 'shipped'){
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        let requestData = req.body;
        if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
        const { shipKits } = require('./firestore');
        const response = await shipKits(requestData);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({message: `Success!`, code:200})
        }

    // Store Receipt POST- BPTL 
    else if(api === 'storeReceipt') {
            if(req.method !== 'POST') {
                return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
            }
            let requestData = req.body;
            if(Object.keys(requestData).length === 0 ) return res.status(400).json(getResponseJSON('Request body is empty!', 400));
            const { storePackageReceipt } = require('./firestore');
            const response = await storePackageReceipt(requestData);
            if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
            return res.status(200).json({message: `Success!`, code:200});
        }

    // BPTL Metrics GET- BPTL 
    else  if(api === 'bptlMetrics') {
            if(req.method !== 'GET') {
                return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
            }
            const { getBptlMetrics } = require('./firestore');
            const response = await getBptlMetrics();
            if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
            return res.status(200).json({data: response, code:200})
        }

    // BPTL Metrics Shipped Kit GET
    else  if(api === 'bptlMetricsShipped') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const { getBptlMetricsForShipped } = require('./firestore');
        const response = await getBptlMetricsForShipped();
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({data: response, code:200})
    }

    else if (api === 'queryBsiData') {
        if(req.method !== 'GET') {
            return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
        }
        const query = req.query.type;
        if(Object.keys(query).length === 0) return res.status(404).json(getResponseJSON('Please include parameter to filter data.', 400));
        const { getQueryBsiData } = require('./firestore');
        const response = await getQueryBsiData(query);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json({data: response, code:200})
    }
    else if (api === 'sendClientEmail') {
        if(req.method !== 'POST') {
            return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
        }
        let requestData = req.body;
        const { sendClientEmail } = require('./firestore');
        const response = await sendClientEmail(requestData);
        if(!response) return res.status(404).json(getResponseJSON('ERROR!', 404));
        return res.status(200).json(getResponseJSON('Success!', 200));
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