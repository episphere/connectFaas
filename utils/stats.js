const { getResponseJSON, setHeaders } = require('./shared');


const stats = async (req, res, authObj) => {
    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
    let obj = {};
    if(authObj) {
        obj = authObj;
    }
    else {
        setHeaders(res);
    
        if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
        
        const { APIAuthorization } = require('./shared');
        const authorized = await APIAuthorization(req);
        if(authorized instanceof Error){
            return res.status(401).json(getResponseJSON(authorized.message, 500));
        }
    
        if(!authorized){
            return res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
    
        const { isParentEntity } = require('./shared');
        obj = await isParentEntity(authorized);
    }
    
    const isParent = obj.isParent;
    const siteCodes = obj.siteCodes;
    
    if(!req.query.type) return res.status(404).json(getResponseJSON('Resource not found', 404));
    const type = req.query.type;
    const { getTable } = require('./bigquery');
    let response
    if(type === 'race') response = await getTable('participants_race_count_by_sites', isParent, siteCodes);
    if(type === 'age') response = await getTable('participant_birthYear_by_siteCode', isParent, siteCodes );
    if(type === 'sex') response = await getTable('participants_sex_count_by_sites', isParent, siteCodes);

    if(type === 'participants_verification') response = await getTable('participants_verification_status', isParent, siteCodes);
    if(type === 'participants_workflow') response = await getTable('participants_workflow_status', isParent, siteCodes);

    if(type === 'participants_recruits_count') response = await getTable('participants_recruits_count', isParent, siteCodes);

    return res.status(200).json({stats: response, code:200});
}

module.exports = {
    stats
}