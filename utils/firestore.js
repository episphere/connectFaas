const firestore = require('@google-cloud/firestore');
const db = new firestore({
    keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
});

const validateKey = async (apiKey) => {
    try{
        const siteDetailsRef = db.collection('siteDetails').where('apiKey', '==', apiKey);
        const response = await siteDetailsRef.get();
        
        if(response.size !== 0) {
            return true;
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    } 
}

const authorizeToken = async(token) => {
    try{
        const siteDetailsRef = db.collection('siteDetails').where('tokens', 'array-contains', token);
        const response = await siteDetailsRef.get();
        if(response.size !== 0) {
            for(let doc of response.docs){
                return doc.data().apiKey;
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const storeResponse = async (data) => {
    try{
        const questionnaireResponseRef = db.collection('questionnaireResponse');
        await questionnaireResponseRef.add(data);
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const getAPIKeyAndAddToken = async (tempToken) => {
    try{
        const siteDetailsRef = db.collection('siteDetails');
        const response = await siteDetailsRef.get();
        if(response.size === 1) {
            for(let doc of response.docs){
                const apiKey = doc.data().apiKey;
                await db.collection("unVerifiedParticipants").add({token: tempToken, verified: false});
                return apiKey;
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error);
    }
}

module.exports = {
    validateKey,
    authorizeToken,
    storeResponse,
    getAPIKeyAndAddToken
}