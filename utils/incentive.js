const { setHeaders, getResponseJSON } = require('./shared');

const incentiveCompleted = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req, true);
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }
    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const { isParentEntity } = require('./shared');
    const {isParent, siteCodes} = await isParentEntity(authorized);

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
                obj[`${roundConcept}.${incentiveConcepts['incentiveIssuedAt']}`] = new Date().toISOString();
            }
            else if (data[i].incentiveRefused) {
                obj[`${roundConcept}.${incentiveConcepts['caseNumber']}`] = caseNumber;
                if(data[i].incentiveChosen) obj[`${roundConcept}.${incentiveConcepts['incentiveChosen']}`] = data[i].incentiveChosen;
                obj[`${roundConcept}.${incentiveConcepts['incentiveRefused']}`] = data[i].incentiveRefused ? 353358909 : 104430631;
                obj[`${roundConcept}.${incentiveConcepts['incentiveRefusedAt']}`] = new Date().toISOString();
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

    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req, true);
    if(authorized instanceof Error){
        return res.status(500).json(getResponseJSON(authorized.message, 500));
    }
    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }
    
    const { isParentEntity } = require('./shared');
    const {isParent, siteCodes} = await isParentEntity(authorized);

    if(siteCodes.indexOf(809703864) !== -1) siteCodes.splice(siteCodes.indexOf(809703864), 1) // remove UoC from Sites list
    if(!req.query.round) return res.status(400).json(getResponseJSON('Round query parameter missing!', 400));
    const round = req.query.round
    if(round !== 'baseline' && round !== 'followup1' && round !== 'followup2' && round !== 'followup3') return res.status(400).json(getResponseJSON('Invalid round!', 400));
    if(req.query.limit && parseInt(req.query.limit) > 1000) return res.status(400).json(getResponseJSON('Bad request, the limit cannot exceed more than 1000 records!', 400));
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