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

module.exports = {
    validateKey
}