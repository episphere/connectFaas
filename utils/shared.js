const getResponseJSON = (message, code) => {
    return { message, code };
};

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
}

const setHeadersDomainRestricted = (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
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
                        "948195369",
                        "685002411", "906417725", "773707518", "747006172", "831041022", "269050420", "659990606", "664453818", "987563196", "123868967", "764403541", // Withdrawal concepts
                        "851245875", "919699172", "141450621", "576083042", "431428747", "121430614", "523768810", "639172801", "175732191", "637147033", "150818546", "624030581", "285488731", "596510649", "866089092", "990579614", "131458944", "372303208", "777719027", "620696506", "352891568", "958588520", "875010152", "404289911", "538619788", // Refusal concepts
                        "912301837",
                        "113579866",
                        
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

const refusalConcepts = {
    851245875: 104430631,
	919699172: 104430631,
	141450621: 104430631,
	576083042: 104430631,
	431428747: 104430631,
	121430614: 104430631,
	523768810: 104430631,
	639172801: 104430631,
	175732191: 104430631,
	637147033: 104430631,
	150818546: 104430631,
	624030581: 104430631,
	285488731: 104430631,
	596510649: 104430631,
	866089092: 104430631,
	990579614: 104430631,
	131458944: 104430631,
	372303208: 104430631,
	777719027: 104430631,
	620696506: 104430631,
	352891568: 104430631,
	958588520: 104430631,
	875010152: 104430631,
	404289911: 104430631,
	538619788: 104430631
}

const withdrawalConcepts = {
    685002411: {
        994064239: 104430631,
        194410742: 104430631,
        949501163: 104430631,
        277479354: 104430631,
        217367618: 104430631,
        867203506: 104430631,
        352996056: 104430631
    },
    906417725: 104430631,
    773707518: 104430631,
    153713899: 104430631,
    747006172: 104430631,
    831041022: 104430631,
    359404406: 104430631,
    987563196: 104430631,
    123868967: '',
    764403541: '',
    113579866: '',
    659990606: '',
    269050420: '',
    664453818: '',
    ...refusalConcepts
}

const optOutReasons = {
    706283025: {
        196038514: 104430631,
        873405723: 104430631,
        517101990: 104430631,
        347614743: 104430631,
        535928798: 104430631,
        897366187: 104430631,
        415693436: '',
        719451909: 104430631,
        377633816: 104430631,
        211023960: 104430631,
        209509101: 104430631,
        363026564: 104430631,
        405352246: 104430631,
        755545718: 104430631,
        831137710: 104430631,
        496935183: 104430631,
        491099823: 104430631,
        836460125: 104430631,
        163534562: 104430631,
        331787113: 104430631,
        705732561: 104430631,
        381509125: 104430631,
        497530905: 104430631,
        627995442: 104430631,
        208102461: 104430631,
        579618065: 104430631,
        702433259: 104430631,
        771146804: 104430631,
        163284008: 104430631,
        387198193: 104430631,
        566047367: 104430631,
        400259098: 104430631,
        260703126: 104430631,
        744197145: 104430631,
        950040334: 104430631
    }
}

const defaultFlags = {
    948195369: 104430631,
    919254129: 104430631,
    821247024: 875007964,
    828729648: 104430631,
    699625233: 104430631,
    912301837: 208325815,
    253883960: 972455046,
    547363263: 972455046,
    949302066: 972455046,
    536735468: 972455046,
    976570371: 972455046,
    663265240: 972455046,
    311580100: 104430631,
    914639140: 104430631,
    ...incentiveFlags,
    ...withdrawalConcepts,
    ...optOutReasons
}

const defaultStateFlags = {
    875549268: 104430631,
    158291096: 104430631
}

const moduleConcepts = {
    "moduleSSN": 'D_166676176'
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
};

const conceptMappings = {
    'verified': 197316935,
    'cannotbeverified': 219863910,
    'duplicate': 922622075,
    'outreachtimedout': 160161595
};

const retentionConcepts = [
    'token',
    'pin',
    'Connect_ID',
    'state.uid',
    'state.studyId',
    '399159511', // user profile first name
    '996038075', // user profile last name
    '371067537', // DOB
    '388711124', // Mobile no.
    '869588347', // Preferred email
    '454205108', // Consent version
    '454445267', // consent datetime
]

const nihSSOConfig = {
    group: 'https://federation.nih.gov/person/DLGroups',
    firstName: 'https://federation.nih.gov/person/FirstName',
    lastName: 'https://federation.nih.gov/person/LastName',
    email: 'https://federation.nih.gov/person/Mail',
    siteManagerUser: 'CN=connect-study-manager-user',
    biospecimenUser: 'CN=connect-biospecimen-user',
    helpDeskUser: 'CN=connect-help-desk-user',
    siteCode: 111111111,
    acronym: 'NIH'
}

const nihSSODevConfig = {
    group: 'https://federation.nih.gov/person/DLGroups',
    firstName: 'https://federation.nih.gov/person/FirstName',
    lastName: 'https://federation.nih.gov/person/LastName',
    email: 'https://federation.nih.gov/person/Mail',
    siteManagerUser: 'connect-study-manager-dev',
    biospecimenUser: 'connect-biospecimen-dev',
    helpDeskUser: 'CN=connect-help-desk-user',
    siteCode: 111111111,
    acronym: 'NIH'
}

const hpSSOConfig = {
    group: 'AD_groups',
    email: 'email',
    siteManagerUser: 'CN=connect-dshbrd-user',
    siteCode: 531629870,
    acronym: 'HP'
}

const sfhSSOConfig = {
    group: 'UserRole',
    email: 'UserEmail',
    siteManagerUser: 'Connect-Study-Manager-User',
    siteCode: 657167265,
    acronym: 'SFH'
}

const hfhsSSOConfig = {
    group: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    siteCode: 548392715,
    acronym: 'HFHS'
}

const kpSSOConfig = {
    group: 'memberOf',
    firstName: 'givenName',
    email: 'userPrincipalName',
    siteManagerUser: 'CN=connect_study_manager_user',
    kpco: {
        name: 'CN=connect_kpco_user',
        siteCode: 125001209,
        acronym: 'KPCO'
    },
    kpnw: {
        name: 'CN=connect_kpnw_user',
        siteCode: 452412599,
        acronym: 'KPNW'
    },
    kphi: {
        name: 'CN=connect_kphi_user',
        siteCode: 300267574,
        acronym: 'KPHI'
    },
    kpga: {
        name: 'CN=connect_kpga_user',
        siteCode: 327912200,
        acronym: 'KPGA'
    }
}

const norcSSOConfig = {
    group: 'http://schemas.xmlsoap.org/claims/Group',
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    helpDeskUser: 'connect-help-desk-user',
    siteCode: 222222222,
    acronym: 'NORC'
}

const mfcSSOConfig = {
    siteCode: 303349821,
    acronym: 'MFC',
    firstName: 'firstName',
    lastName: 'lastName',
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    group: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    siteManagerUser: 'connect-study-manager-user',
    biospecimenUser: 'connect-biospecimen-user'
}

const ucmSSOConfig = {
    group: '1.3.6.1.4.1.9902.2.1.41',
    firstName: 'urn:oid:0.9.2342.19200300.100.1.1',
    email: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
    siteManagerUser: 'uc:org:bsd:applications:connect:connect-study-manager-user:authorized',
    biospecimenUser: 'uc:org:bsd:applications:connect:connect-biospecimen-user:authorized',
    siteCode: 809703864,
    acronym: 'UCM'
}

const SSOConfig = {
    'NIH-SSO-qfszp': nihSSODevConfig,
    'NIH-SSO-9q2ao': nihSSODevConfig,
    'NIH-SSO-wthvn': nihSSOConfig,

    'HP-SSO-wb1zb': hpSSOConfig,
    'HP-SSO-1elez': hpSSOConfig,
    'HP-SSO-252sf': hpSSOConfig,

    'SFH-SSO-cgzpj': sfhSSOConfig,
    'SFH-SSO-uetfo': sfhSSOConfig,
    'SFH-SSO-pb390': sfhSSOConfig,

    'HFHS-SSO-ay0iz': hfhsSSOConfig,
    'HFHS-SSO-eq1f': hfhsSSOConfig,
    'HFHS-SSO-lo99j': hfhsSSOConfig,

    'KP-SSO-wulix': kpSSOConfig,
    'KP-SSO-ssj7c': kpSSOConfig,
    'KP-SSO-ii9sr': kpSSOConfig,

    'NORC-SSO-dilvf': norcSSOConfig,
    'NORC-SSO-l80az': norcSSOConfig,
    'NORC-SSO-nwvau': norcSSOConfig,

    'MFC-SSO-fljvd': mfcSSOConfig,
    'MFC-SSO-6x4zy': mfcSSOConfig,
    'MFC-SSO-tdj17': mfcSSOConfig,

    'UCM-SSO-tovai': ucmSSOConfig,
    'UCM-SSO-lrjsp': ucmSSOConfig,
    'UCM-SSO-p4f5m': ucmSSOConfig
}

const decodingJWT = (token) => {
    if(token !== null || token !== undefined){
        const base64String = token.split('.')[1];
        const decodedValue = JSON.parse(Buffer.from(base64String, 'base64').toString());
        return decodedValue;
    }
    return null;
}

const SSOValidation = async (dashboardType, idToken) => {
    try {
        console.log(idToken)
        const decodedJWT = decodingJWT(idToken);
        const tenant = decodedJWT.firebase.tenant;
        const { validateMultiTenantIDToken } = require('./firestore');
        const decodedToken = await validateMultiTenantIDToken(idToken, tenant);
        if(decodedToken instanceof Error) {
            return false;
        }
        const allGroups = decodedToken.firebase.sign_in_attributes[SSOConfig[tenant]['group']];
        const email = decodedToken.firebase.sign_in_attributes[SSOConfig[tenant]['email']];
        console.log(allGroups)
        console.log(email)
        if(!SSOConfig[tenant][dashboardType]) return false;
        const requiredGroups = new RegExp(SSOConfig[tenant][dashboardType], 'g').test(allGroups.toString());
        if(!requiredGroups) return false;
        let acronym = SSOConfig[tenant].acronym;
        if(tenant === 'KP-SSO-wulix') {
            const moreThanOneRegion = allGroups.toString().match(/CN=connect_kp(co|hi|nw|ga)_user/ig);
            if(moreThanOneRegion.length > 1) return false;
            if(new RegExp(SSOConfig[tenant]['kpco']['name'], 'g').test(allGroups.toString())) acronym = SSOConfig[tenant]['kpco']['acronym'];
            if(new RegExp(SSOConfig[tenant]['kpga']['name'], 'g').test(allGroups.toString())) acronym = SSOConfig[tenant]['kpga']['acronym'];
            if(new RegExp(SSOConfig[tenant]['kphi']['name'], 'g').test(allGroups.toString())) acronym = SSOConfig[tenant]['kphi']['acronym'];
            if(new RegExp(SSOConfig[tenant]['kpnw']['name'], 'g').test(allGroups.toString())) acronym = SSOConfig[tenant]['kpnw']['acronym'];
            if(!acronym) return false;
        }
        console.log(acronym)
        const { getSiteDetailsWithSignInProvider } = require('./firestore');
        const siteDetails = await getSiteDetailsWithSignInProvider(acronym);
        return {siteDetails, email};
    } catch (error) {
        return false;
    }
}

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
    return {isParent, siteCodes, ...authorized};
}

const logIPAdddress = (req) => {
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(ipAddress)
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
    defaultStateFlags,
    SSOValidation,
    conceptMappings,
    logIPAdddress,
    decodingJWT
}