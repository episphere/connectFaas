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
    let pinChecker = false;
    let pin
    while(pinChecker === false) {
        pin = (Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1)).toUpperCase();
        if(!pin.includes('0') && !pin.includes('O')) pinChecker = true;
    }
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

const lockedAttributes = ["state", "token", "pin", "Connect_ID", "821247024", "230663853", "266600170", "496823485", "650465111", "303552867"] // Read only access after initialization

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
    lockedAttributes
}