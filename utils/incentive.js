const { setHeaders, getResponseJSON } = require('./shared');

const incentiveCompleted = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`incentiveCompleted ${new Date()} ${siteKey}`)
    if(req.body.data === undefined || req.body.data.length === 0 || req.body.data.length > 499) return res.status(400).json(getResponseJSON('Bad request!', 400));
    const { validateSiteUser } = require(`./firestore`);
    const authorized = await validateSiteUser(siteKey);
    
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    if(authorized.acronym !== 'NORC') return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    
    const ID = authorized.id;
    const { getChildrens } = require('./firestore');
    let siteCodes = await getChildrens(ID);
    let isParent = siteCodes ? true : false;
    siteCodes = siteCodes ? siteCodes : authorized.siteCode;

    const data = req.body.data;
    for(let i = 0; i < data.length; i++) {
        if(data[i].token && data[i].round && data[i].caseNumber) {
            const token = data[i].token;
            const round = data[i].round;
            if(round !== 'baseline' && round !== 'followup1' && round !== 'followup2' && round !== 'followup3') continue;
            const caseNumber = data[i].caseNumber;
            
            const { incentiveConcepts } = require('./shared');
            const roundConcept = incentiveConcepts[round];
            let obj = {};
            if(data[i].incentiveIssued) {
                obj[`${roundConcept}.${incentiveConcepts['caseNumber']}`] = caseNumber;
                if(data[i].incentiveChosen) obj[`${roundConcept}.${incentiveConcepts['incentiveChosen']}`] = data[i].incentiveChosen;
                obj[`${roundConcept}.${incentiveConcepts['incentiveIssued']}`] = data[i].incentiveIssued ? 353358909 : 104430631;
                if(data[i].incentiveIssuedAt) obj[`${roundConcept}.${incentiveConcepts['incentiveIssuedAt']}`] = data[i].incentiveIssuedAt;
            }
            else if (data[i].incentiveRefused) {
                obj[`${roundConcept}.${incentiveConcepts['caseNumber']}`] = caseNumber;
                if(data[i].incentiveChosen) obj[`${roundConcept}.${incentiveConcepts['incentiveChosen']}`] = data[i].incentiveChosen;
                obj[`${roundConcept}.${incentiveConcepts['incentiveRefused']}`] = data[i].incentiveRefused ? 353358909 : 104430631;
                if(data[i].incentiveRefusedAt) obj[`${roundConcept}.${incentiveConcepts['incentiveRefusedAt']}`] = data[i].incentiveRefusedAt;
            }
            const { updateParticipantRecord } = require(`./firestore`);
            await updateParticipantRecord('token', token, siteCodes, isParent, obj);
        }
    }
    return res.status(200).json(getResponseJSON('Success!', 200));

}

const eligibleForIncentive = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`eligibleForIncentive ${new Date()} ${siteKey}`)
    
    const { validateSiteUser } = require(`./firestore`);
    const authorized = await validateSiteUser(siteKey);
    
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    if(authorized.acronym !== 'NORC') return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    
    const ID = authorized.id;
    const { getChildrens } = require('./firestore');
    let siteCodes = await getChildrens(ID);
    const isParent = siteCodes ? true : false;
    siteCodes = siteCodes ? siteCodes : authorized.siteCode;
    if(siteCodes.indexOf(809703864) !== -1) siteCodes.splice(siteCodes.indexOf(809703864), 1)
    if(!req.query.round) return res.status(400).json(getResponseJSON('Round query parameter missing!', 400));
    const round = req.query.round
    if(round !== 'baseline' && round !== 'followup1' && round !== 'followup2' && round !== 'followup3') return res.status(400).json(getResponseJSON('Invalid round!', 400));
    const limit = req.query.limit ? parseInt(req.query.limit) : 500;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const { retrieveParticipantsEligibleForIncentives } = require('./firestore');
    const data = await retrieveParticipantsEligibleForIncentives(siteCodes, round, isParent, limit, page);

    if(data instanceof Error){
        return res.status(500).json(getResponseJSON(data.message, 500));
    }

    return res.status(200).json({data, code:200, limit, dataSize: data.length})
}

module.exports = {
    incentiveCompleted,
    eligibleForIncentive
}