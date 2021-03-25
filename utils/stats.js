const { getResponseJSON, setHeaders } = require('./shared');


const stats = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { APIAuthorization } = require('./shared');
    const authorized = await APIAuthorization(req);
    if(authorized instanceof Error){
        return res.status(401).json(getResponseJSON(authorized.message, 500));
    }

    if(!authorized){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const { isParentEntity } = require('./shared');
    const {isParent, siteCodes} = await isParentEntity(authorized)
    if(!req.query.type) return res.status(404).json(getResponseJSON('Resource not found', 404));
    const type = req.query.type;
    const { getTable } = require('./bigquery');
    let response
    if(type === 'race') response = await getTable('participants_race_count_by_sites', isParent, siteCodes);
    if(type === 'age') response = await getTable('participants_age_range_count_by_sites', isParent, siteCodes);
    if(type === 'sex') response = await getTable('participants_sex_count_by_sites', isParent, siteCodes);
    if(type === 'metrics_denominator') response = await getTable('participants_workflow_status', isParent, siteCodes, 'metricsDenominator'); 

    if(type === 'active_verification_status') response = await getTable('participants_verification_status', isParent, siteCodes, 'activeVerification');
    if(type === 'verification_status_denominator') response = await getTable('participant_verification_status_denominator', isParent, siteCodes, 'VerificationDenominator');
    if(type === 'passive_verification_status') response = await getTable('participants_verification_status', isParent, siteCodes, 'passiveVerification');

    if(type === 'active_participant_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'currentWorkflow', 'active'); 
    if(type === 'passive_participant_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'currentWorkflow', 'passive'); 
    if(type === 'total_participant_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'totalCurrentWorkflow'); 

    if(type === 'active_cummulative_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'cummulativeWorkflow', 'active'); 
    if(type === 'passive_cummulative_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'cummulativeWorkflow', 'passive');
    if(type === 'total_cummulative_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes, 'totalCummulativeWorkflow'); 

    if(type === 'active_recruits') response = await getTable('participants_active_recruits', isParent, siteCodes, 'activeRecruits');
    if(type === 'passive_recruits') response = await getTable('participants_passive_recruits', isParent, siteCodes, 'passiveRecruits');

    return res.status(200).json({stats: response, code:200});
}

module.exports = {
    stats
}