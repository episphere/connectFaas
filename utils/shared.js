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
                        "311580100",
                        "158291096",
                        "948195369"
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

const defaultFlags = {
    158291096: 104430631,
    948195369: 104430631,
    919254129: 104430631,
    821247024: 875007964,
    828729648: 104430631,
    699625233: 104430631
}

const moduleConcepts = {
    "moduleSSN": 'D_716117818'
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

const SSOConfig = {
    'NIH-SSO-qfszp': {
        group: 'https://federation.nih.gov/person/Groups',
        firstName: 'https://federation.nih.gov/person/FirstName',
        lastName: 'https://federation.nih.gov/person/LastName',
        email: 'https://federation.nih.gov/person/Mail',
        siteManagerUser: 'CN=connect-study-manager-user',
        biospecimenUser: 'CN=connect-biospecimen-user',
        helpDeskUser: 'CN=connect-help-desk-user'
    },
    'UCM-SSO-tovai': {
        group: '1.3.6.1.4.1.9902.2.1.41',
        firstName: 'urn:oid:0.9.2342.19200300.100.1.1',
        email: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
        siteManagerUser: 'uc:org:bsd:applications:connect:connect-study-manager-user:authorized',
        biospecimenUser: 'uc:org:bsd:applications:connect:connect-biospecimen-user:authorized'
    }
}

const SSOValidation = async (dashboardType, idToken) => {
    try {
        const decodedJWT = decodingJWT(idToken);
        const tenant = decodedJWT.firebase.tenant;
        const signInProvider = decodedJWT.firebase.sign_in_provider;
        const { validateMultiTenantIDToken } = require('./firestore');
        const decodedToken = await validateMultiTenantIDToken(idToken, tenant);
        if(decodedToken instanceof Error) {
            return false;
        }
        const allGroups = decodedToken.firebase.sign_in_attributes[SSOConfig[tenant]['group']];
        const requiredGroups = allGroups.filter(dt => new RegExp(SSOConfig[tenant][dashboardType], 'g').test(dt));
        if(requiredGroups.length === 0) return false;
        const { getSiteDetailsWithSignInProvider } = require('./firestore');
        const siteDetails = await getSiteDetailsWithSignInProvider(signInProvider);
        return siteDetails;
    } catch (error) {
        return false;
    }
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
    if(!req.headers.authorization || req.headers.authorization.trim() === "" || req.headers.authorization.replace('Bearer ','').trim() === ""){
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
    moduleConcepts,
    incentiveConcepts,
    APIAuthorization,
    isParentEntity,
    defaultFlags,
    SSOValidation
}