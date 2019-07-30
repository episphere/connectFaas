// const firestore = require('@google-cloud/firestore');
// const db = new firestore({
//     keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
// });

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const validateKey = async (apiKey) => {
    try{
        const response = await db.collection('siteDetails').where('apiKey', '==', apiKey).get();
        
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
        const response = await db.collection('participants').where('token', '==', token).get();
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
        await db.collection('participants').add(data);
        return true;
    }
    catch(error){
        return new Error(error);
    }
}

const updateResponse = async (data) => {
    try{
        const response = await db.collection('participants').where('token', '==', data.token).get();
        if(response.size === 1) {
            for(let doc of response.docs){
                await db.collection('participants').doc(doc.id).update(data);
                return true;
            }
        }
        else{
            const storeData = await storeResponse(data);
            return storeData;
        }
    }
    catch(error){
        return new Error(error)
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
            return new Error('Data not found!')
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
    retrieveAPIKey,
    updateResponse
}