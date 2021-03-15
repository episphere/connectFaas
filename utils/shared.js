const getResponseJSON = (message, code) => {
    return { message, code };
};

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
}

const setHeadersDomainRestricted = (req, res) => {
    const allowedOrigins = ['http://localhost:5000', 'https://episphere.github.io'];
    // const allowedOrigins = ['https://episphere.github.io'];
    const origin = req.headers.origin;
    if(allowedOrigins.indexOf(origin) !== -1){
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
   }
}

const generateConnectID = () => {
    return Math.floor(Math.random() * (9999999999 - 1000000000)) + 1000000000;
}

const generatePIN = () => {
    return Math.floor(Math.random() * (999999 - 100000)) + 100000;
}

const randomString = () => {
    const length = 6;
    let pin = '';
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    for (let i = length; i > 0; --i) pin += chars[Math.round(Math.random() * (chars.length - 1))];
    return pin;
}

const deleteDocuments = (req, res) => {
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const siteCode = 809703864;
    const { deleteFirestoreDocuments } = require('./firestore')
    deleteFirestoreDocuments(siteCode)
    res.status(200).json(getResponseJSON('Success!', 200))
}

const lockedAttributes = [
                        "state", 
                        "token", 
                        "pin", 
                        "Connect_ID", 
                        "821247024", 
                        "230663853", 
                        "266600170", 
                        "496823485", 
                        "650465111", 
                        "303552867", 
                        "512820379",
                        "598680838",
                        "454067894",
                        "914639140",
                        "311580100"
                    ] // Read only access after initialization

const filterData = async (queries, siteCodes, isParent) => {
    console.log(queries);
    const { filterDB } = require('./firestore');
    const result = await filterDB(queries, siteCodes, isParent);
    return result;
}

const incentiveFlags = {
    266600170: { // Baseline
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    496823485: { // Follow up 1
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    650465111: { // Follow up 2
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    303552867: { // Follow up 3
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    }
}

const incentiveConcepts = {
    'baseline': 266600170,
    'followup1': 496823485,
    'followup2': 650465111,
    'followup3': 303552867,
    'incentiveIssued': 648936790,
    'incentiveIssuedAt': 297462035,
    'incentiveRefused': 648228701,
    'incentiveRefusedAt': 438636757,
    'caseNumber': 320023644,
    'incentiveChosen': 945795905
}

const SSOValidation = async (idToken) => {
    const tenant = decodingJWT(idToken).firebase.tenant;
    const { validateMultiTenantIDToken } = require('./firestore');
    const decodedToken = await validateMultiTenantIDToken(idToken, tenant);
    console.log(decodedToken.firebase.sign_in_attributes)
}

const decodingJWT = (token) => {
    if(token !== null || token !== undefined){
        const base64String = token.split('.')[1];
        const decodedValue = JSON.parse(Buffer.from(base64String, 'base64').toString('ascii'));
        return decodedValue;
    }
    return null;
}

// SSOValidation();

const APIAuthorization = async (req, notAuthorized) => {
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return false;
    }
    try {
        let authorized = false;
        const access_token = req.headers.authorization.replace('Bearer ','').trim();
        
        // Remove this after SSO and SA authorization are implemented.
        const { validateSiteUser } = require(`./firestore`);
        authorized = await validateSiteUser(access_token);
        if(!notAuthorized && authorized && authorized.acronym === 'NORC') authorized = false;
        if(notAuthorized && authorized && authorized.acronym !== 'NORC') authorized = false;
        if(authorized instanceof Error){
            return new Error(authorized)
        }
        if(authorized) return authorized;

        const {google} = require("googleapis");
        const OAuth2 = google.auth.OAuth2;
        const oauth2Client = new OAuth2();
        oauth2Client.setCredentials({access_token: access_token});
        const oauth2 = await google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });

        const response = await oauth2.userinfo.get();
        if(response.status === 200) {
            const saEmail = response.data.email;
            console.log('API accessed by ' +saEmail);
            const { validateSiteSAEmail } = require(`./firestore`);
            authorized = await validateSiteSAEmail(saEmail);
            if(!notAuthorized && authorized && authorized.acronym === 'NORC') authorized = false;
            if(notAuthorized && authorized && authorized.acronym !== 'NORC') authorized = false;
            if(authorized instanceof Error){
                return new Error(authorized)
            }
            if(authorized) return authorized;
        }
        return false;
    } catch (error) {
        if(error.code === 401) return false;
        else return new Error(error)
    }
}

const isParentEntity = async (authorized) => {
    const ID = authorized.id;
    const { getChildrens } = require('./firestore');
    let siteCodes = await getChildrens(ID);
    let isParent = siteCodes ? true : false;
    siteCodes = siteCodes ? siteCodes : authorized.siteCode;
    return {isParent, siteCodes};
}

module.exports = {
    getResponseJSON,
    setHeaders,
    generateConnectID,
    generatePIN,
    randomString,
    deleteDocuments,
    setHeadersDomainRestricted,
    filterData,
    incentiveFlags,
    lockedAttributes,
    incentiveConcepts,
    APIAuthorization,
    isParentEntity
}