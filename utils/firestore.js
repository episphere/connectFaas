// const firestore = require('@google-cloud/firestore');
// const db = new firestore({
//     keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
// });

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const validateKey = async (access_token) => {
    try{
        const response = await db.collection('apiKeys').where('access_token', '==', access_token).get();
        
        if(response.size !== 0) {
            const expiry = response.docs[0].data().expires.toDate().getTime();
            const currentTime = new Date().getTime();
            if(expiry > currentTime){
                return true;
            }
            else{
                return false;
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

const authorizeToken = async(token, res) => {
    try{
        const response = await db.collection('apiKeys').where('token', '==', token).get();
        if(response.size > 0) {
            for(let doc of response.docs){
                const expiry = doc.data().expires.toDate().getTime();
                const currentTime = new Date().getTime();
                
                if(expiry > currentTime){
                    return doc.data().access_token
                }
                else{
                    const uuid = require('uuid');
                    const data = {
                        access_token: uuid(),
                        expires: new Date(Date.now() + 3600000)
                    }
                    res.header('expires', data.expires);
                    await db.collection('apiKeys').doc(doc.id).update(data);
                    return data.access_token;
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
        const response = await db.collection('participants').where('state.token', '==', data.token).get();
        if(response.size > 0) {
            const latestVersion = response.docs.reduce((max, record) => record.data().version > max ? record.data().version : max, 0);
            data.version = latestVersion + 1;
            await db.collection('participants').add(data);
            return true;
        }
        else{
            data.version = 1;
            await db.collection('participants').add(data);
            return true;
        }
    }
    catch(error){
        return new Error(error);
    }
}

const updateResponse = async (data) => {
    try{
        const response = await db.collection('participants').where('state.token', '==', data.token).get();
        if(response.size === 1) {
            for(let doc of response.docs){
                delete data.token;
                await db.collection('participants').doc(doc.id).update(data);
                return true;
            }
        }
    }
    catch(error){
        return new Error(error)
    }
}

const storeAPIKeyandToken = async (data) => {
    try{
        await db.collection('apiKeys').add(data);
        await db.collection('participants').add({state: {token: data.token, verified: false}});
        return true;
        
    }
    catch(error){
        return new Error(error);
    }
    
}

const retrieveQuestionnaire = async (source) => {
    try{
        const data = await db.collection('questionnaire').where('source', '==', source).orderBy('sequence').get();
        if(data.size !== 0){
            return data.docs.map(document => document.data());
        }
        else{
            return new Error(`No questions found for source ${source}`);
        }
    }
    catch(error){
        return new Error(error);
    }
}

module.exports = {
    validateKey,
    authorizeToken,
    storeAPIKeyandToken,
    retrieveQuestionnaire,
    updateResponse
}