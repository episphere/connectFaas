const { getResponseJSON, setHeaders } = require('./shared');

const validate = async (req, res) => {
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        if(!req.headers.authorization || req.headers.authorization.trim() === ""){
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        else{
            let access_token = req.headers.authorization.replace('Bearer','').trim();
            const { validateKey } = require(`./firestore`);
            const authorize = await validateKey(access_token);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                res.status(200).json(getResponseJSON('Success!', 200));
            }
            else{
                res.status(401).json(getResponseJSON('Authorization failed!', 401));
            }
        }
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const validateToken = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        if(req.query.token && req.query.token.trim() !== ""){
            const token = req.query.token;
            const { authorizeToken } = require('./firestore');
            const authorize = await authorizeToken(token);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                res.header('expires', authorize.expires);
                res.header('Set-Cookie', `access_token=${authorize.access_token}; Expires=${authorize.expires}`)
                res.status(200).json({access_token: authorize.access_token, code: 200});
            }
            else{
                res.status(401).json(getResponseJSON('Authorization failed!', 401));
            }
        }else{
            res.status(406).json(getResponseJSON('Token missing!', 406));
        }
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const getKey = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method === 'GET') {
        const expires = new Date(Date.now() + 3600000);
        res.header('expires', expires);
        const uuid = require('uuid');
        const data = {
            access_token: uuid(),
            token: uuid(),
            expires: expires
        }
        
        const { storeAPIKeyandToken } = require('./firestore');
        const response = await storeAPIKeyandToken(data);
        if(response instanceof Error){
            return res.status(500).json(getResponseJSON(response.message, 500));
        }
        if(response){
            res.header('Set-Cookie', `access_token=${data.access_token}; Expires=${expires}`)
            return res.status(200).json({access_token: data.access_token, token: data.token, code: 200});
        }
    }
    else {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

const validateSiteUsers = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    return res.status(200).json(getResponseJSON('Ok', 200));
}

const validateUserSession = (req, res) => {
    const admin = require('firebase-admin');
    admin.initializeApp({
            keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
        });
    const idToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI5NGNlMzNhNWQ3MmI0NjYyNzI3ZGFiYmRhNzVjZjg4Y2Y5OTg4MGUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQmhhdW1payBQYXRlbCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9uaWgtbmNpLWRjZWctZXBpc3BoZXJlLWRldiIsImF1ZCI6Im5paC1uY2ktZGNlZy1lcGlzcGhlcmUtZGV2IiwiYXV0aF90aW1lIjoxNTY5OTUwMDY4LCJ1c2VyX2lkIjoicU9PM3p0UXpWRFhZRDZWWkt3Ulh5ZjF2ektoMiIsInN1YiI6InFPTzN6dFF6VkRYWUQ2VlpLd1JYeWYxdnpLaDIiLCJpYXQiOjE1Njk5NTExODMsImV4cCI6MTU2OTk1NDc4MywiZW1haWwiOiJiaGF1bWlrNzIzMEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJiaGF1bWlrNzIzMEBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.0z9KNaWNJV3eEZ5DmSDNfVwlUfUWhMPSUIxvJk5eZXECbQV1qtnQvmSVHWJ2TOA5fX-Igx8Eb5viu4Ad5nb_Ew1ElDmDXXMpdDeWFjbqx5uh-UHC7kj1b2Xee8gKFA59ZS4f9tooUPZgpmZ_AiTJFu74V3Q5f8nw1tI38nrnqaECVfnCp7uXBoL-2AnMevdMz58P5sv_4abWTD76PIF0NYrX9xGPOUTTZPGpe9CJVWrBmKGp52eIqe6ix-v0yfeg2WSDpCwUiZmohN-coL41Abdasifw6UFsJzNdhQsrj1b9QLu7n-bjtjfprDq8UIGa2IC8IX3qQPpSjtWdKgkT7Q';
    admin.auth().verifyIdToken(idToken)
    .then(function(decodedToken) {
        console.log(decodedToken)
        let uid = decodedToken.uid;
        // ...
    }).catch(function(error) {
        // Handle error
    });
}

const getToken = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const uuid = require('uuid');
    if(Object.keys(req.body).length > 0){
        let responseArray = [];
        if(Object.keys(req.body).length > 1000) return res.status(400).json(getResponseJSON('Bad request!', 400));
        const data = req.body;
        
        for(let dt in data){
            
            if(data[dt].studyId){
                const studyId = data[dt].studyId
                const { recordExists } = require('./firestore');
                if(await recordExists(studyId) === false){
                    const obj = {
                        state: {
                            studyId: studyId
                        },
                        siteCode: authorize.siteCode,
                        token: uuid()
                    }
                    const { createRecord } = require('./firestore');
                    createRecord(obj);
                    responseArray.push({studyId: studyId, token: obj.token});
                }
            }
       };
       return res.status(200).json({data: responseArray, code: 200});
    }
    else {
        const data = {
            token: uuid()
        }
        const { createRecord } = require('./firestore');
        createRecord(data);
        return res.status(200).json({data, code: 200});
    }
}

module.exports = {
    validate,
    validateToken,
    getKey,
    validateSiteUsers,
    validateUserSession,
    getToken
}
