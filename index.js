exports.validate = async (req, res) => {
    if(!req.headers.authorization || req.headers.authorization === ""){
       res.status(401).json({message: "Authorization failed!", code: 401});
    }
    const firestore = require('@google-cloud/firestore');
    const path = require('path');
    const db = new firestore({
        keyFilename: path.join(__dirname, 'nih-nci-dceg-episphere-dev-70e8e321d62d.json'),
    });
    let token = req.headers.authorization.replace('Bearer','').trim();
    try{
        const siteDetailsRef = db.collection('siteDetails').where('apiKey', '==', token);
        const response = await siteDetailsRef.get();
        if(response.docs && response.docs.length !== 0) {
            res.status(200).json({message: 'Success!!', code: 200});
        }
        else{
            res.status(401).json({message: "Authorization failed!", code: 401});
        }
    }
    catch(error){
        res.status(500).json({error: error});
    }  
};
 