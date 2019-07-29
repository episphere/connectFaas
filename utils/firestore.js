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
        const siteDetailsRef = db.collection('participants').where('token', '==', token);
        const response = await siteDetailsRef.get();
        if(response.size !== 0) {
            for(let doc of response.docs){
                const affiliatedSite = doc.data().affiliatedSite;
                const site = await db.collection('siteDetails').where('siteName', '==', affiliatedSite).get();
                if(site.size === 1){
                    for(let siteDoc of site.docs){
                        return siteDoc.data();
                    }
                }
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
        const questionnaireResponseRef = db.collection('participants');
        await questionnaireResponseRef.add(data);
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const updateResponse = async (data) => {
    try{
        const questionnaireResponseRef = db.collection('participants').where('token', '==', data.token);
        const response = await questionnaireResponseRef.get();
        if(response.size === 1) {
            for(let doc of response.docs){
                await db.collection('participants').doc(doc.id).update(data);
                return true;
            }
        }
        else{
            return false;
        }
    }
    catch(error){
        return new Error(error)
    }
}

const getAPIKeyAndAddToken = async (tempToken) => {
    try{
        await db.collection("participants").add({token: tempToken, verified: 0, affiliatedSite: 88});
        const siteDetailsRef = db.collection('siteDetails').where('siteName', '==', 88);
        const response = await siteDetailsRef.get();
        if(response.size === 1) {
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

const retrieveAPIKey = async () => {
    try{
        const data = await db.collection('siteDetails').where('siteName', '==', 88).get();
        if(data.size === 1){
            for(let siteDoc of data.docs){
                return siteDoc.data().apiKey;
            }
        }
        else{
            return new Error('Site not found!')
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
    getAPIKeyAndAddToken,
    retrieveAPIKey,
    updateResponse
}