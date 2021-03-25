const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const fieldMapping =  {
    'active': 486306141,
    'passive': 854703046,
    'yes': 353358909,
    'no': 104430631,
    'notYetVerified': 875007964,
    'outreachTimedout': 160161595,
    'verified': 197316935,
    'cannotBeVerified': 219863910,
    'duplicate': 922622075
    }


const filterVerificationStatus = (stats, currentVerificationObj) => {
    stats.forEach((i) => {
        
    if (i.verificationStatus === fieldMapping.notYetVerified) {
        currentVerificationObj.notYetVerified = i.verificationCount
    }
    else if (i.verificationStatus === fieldMapping.outreachTimedout) {
        currentVerificationObj.outreachTimedout = i.verificationCount
    }
    else if (i.verificationStatus === fieldMapping.verified) {
        currentVerificationObj.verified = i.verificationCount
    }
    else if (i.verificationStatus === fieldMapping.cannotBeVerified) {
        currentVerificationObj.cannotBeVerified = i.verificationCount
    }
    else {
        currentVerificationObj.duplicate = i.verificationCount
    }
    });
    return currentVerificationObj;
}

const getTable = async (tableName, isParent, siteCode, status, recruit) => {
    const dataset = bigquery.dataset('stats');
    const [tableData] = await dataset.table(tableName).getRows();
    let data = '';

    if(isParent){
        
        data = tableData.filter(dt => siteCode.indexOf(dt.siteCode) !== -1)
    }
    else {
        data = tableData.filter(dt => dt.siteCode === siteCode)
    }

    if (status === 'metricsDenominator') {
        let metricsDenominatorObj = {}
        let verifiedCount = 0
        let verified = data.filter(i => 
        ((i.recruitType === fieldMapping.active || fieldMapping.passive) && (i.verificationStatus === fieldMapping.verified ) ))
        verified.forEach((i) => {
            verifiedCount += i.verificationCount
        })
        metricsDenominatorObj.verified = verifiedCount
        data = metricsDenominatorObj
    }

    if (status === 'activeRecruits'){
        data = data.filter(i => (i.activeCount))
    }
    
    if (status === 'passiveRecruits'){
        data = data.filter(i => (i.passiveCount))
    }

    if (status === 'activeVerification') {
        let currentVerificationObj = {};
        let filteredData = data.filter(i => i.recruitType === fieldMapping.active);
        data = filterVerificationStatus(filteredData, currentVerificationObj);

    }

   if (status === 'passiveVerification') {
        let currentVerificationObj = {};
        let filteredData = data.filter(i => i.recruitType === fieldMapping.passive);
        data = filterVerificationStatus(filteredData, currentVerificationObj);
    }

    if (status === 'VerificationDenominator') {
        let currentObj = {};
        let activeDenominator = data.filter(i => i.recruitType === fieldMapping.active);
        let passiveDenominator = data.filter(i => i.recruitType === fieldMapping.passive);
        currentObj.activeDenominator = activeDenominator[0].consentCount;
        currentObj.passiveDenominator = passiveDenominator[0].consentCount;
        data = currentObj; 
    }

    if (status === 'currentWorkflow' && recruit) {
        let recruitType = fieldMapping[recruit]
        let currentWorflowObj = {}
        let notSignedIn = data.filter(i => (i.recruitType === recruitType && i.signedStatus === fieldMapping.no))
        let signedIn = data.filter(i => (i.recruitType === recruitType && i.signedStatus === fieldMapping.yes && i.consentStatus === fieldMapping.no))
        let consented = data.filter(i => (i.recruitType === recruitType && i.consentStatus === fieldMapping.yes && i.submittedStatus === fieldMapping.no))
        let submittedProfile = data.filter(i => 
                                (i.recruitType === recruitType && i.submittedStatus === fieldMapping.yes && (i.verificationStatus === fieldMapping.notYetVerified || i.verificationStatus === fieldMapping.outreachTimedout) ))
        let verification = data.filter(i => 
                                (i.recruitType === recruitType && (i.verificationStatus === fieldMapping.verified || i.verificationStatus === fieldMapping.cannotBeVerified || i.verificationStatus === fieldMapping.duplicate ) ))
        console.log('notSignedIn', notSignedIn)
        if (recruitType === fieldMapping.passive) currentWorflowObj.notSignedIn = 0
        else currentWorflowObj.notSignedIn = notSignedIn[0].signedCount
        currentWorflowObj.signedIn = signedIn[0].signedCount
        currentWorflowObj.consented = consented[0].consentCount
        currentWorflowObj.submittedProfile = submittedProfile[0].submittedCount
        currentWorflowObj.verification = verification[0].verificationCount
        data = currentWorflowObj        
    }

    if (status === 'totalCurrentWorkflow') {
        let currentWorflowObj = {}
        let notSignedIn = data.filter(i => ((i.recruitType === fieldMapping.active) && i.signedStatus === fieldMapping.no))
        let signedIn = data.filter(i => ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.signedStatus === fieldMapping.yes && i.consentStatus === fieldMapping.no))
        let consented = data.filter(i => ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.consentStatus === fieldMapping.yes && i.submittedStatus === fieldMapping.no))
        let submittedProfile = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.submittedStatus === fieldMapping.yes && (i.verificationStatus === fieldMapping.notYetVerified || i.verificationStatus === fieldMapping.outreachTimedout) ))
        let verification = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && (i.verificationStatus === fieldMapping.verified || i.verificationStatus === fieldMapping.cannotBeVerified || i.verificationStatus === fieldMapping.duplicate ) ))
        currentWorflowObj.notSignedIn = notSignedIn[0].signedCount
        currentWorflowObj.signedIn = signedIn[0].signedCount
        currentWorflowObj.consented = consented[0].consentCount
        currentWorflowObj.submittedProfile = submittedProfile[0].submittedCount
        currentWorflowObj.verification = verification[0].verificationCount
        data = currentWorflowObj        
    }

    if (status === 'cummulativeWorkflow' && recruit) {
        let recruitType = fieldMapping[recruit]
        let currentWorflowObj = {}
        let signedInCount = 0
        let consentedCount = 0
        let submittedProfileCount = 0
        let verificationCount = 0
        let verifiedCount = 0

        let signedIn = data.filter(i => 
            (i.recruitType === recruitType && i.signedStatus === fieldMapping.yes))
            signedIn.forEach((i) => {
                signedInCount += i.signedCount
            })
        let consented = data.filter(i => 
            (i.recruitType === recruitType && i.consentStatus === fieldMapping.yes))
            consented.forEach((i) => {
                consentedCount += i.consentCount
            })
        let submittedProfile = data.filter(i => 
            (i.recruitType === recruitType && i.submittedStatus === fieldMapping.yes))
            submittedProfile.forEach((i) => {
                submittedProfileCount += i.submittedCount
            })
        let verification = data.filter(i => 
            (i.recruitType === recruitType && (i.verificationStatus === fieldMapping.verified || i.verificationStatus === fieldMapping.cannotBeVerified || i.verificationStatus === fieldMapping.duplicate ) ))
            verification.forEach((i) => {
                verificationCount += i.verificationCount
            })
        
        let verified = data.filter(i => 
            (i.recruitType === recruitType && (i.verificationStatus === fieldMapping.verified ) ))
            verified.forEach((i) => {
                verifiedCount += i.verificationCount
            })
        
        currentWorflowObj.signedIn = signedInCount
        currentWorflowObj.consented = consentedCount
        currentWorflowObj.submittedProfile = submittedProfileCount
        currentWorflowObj.verification = verificationCount
        currentWorflowObj.verified = verifiedCount
        data = currentWorflowObj     
    }


    if (status === 'totalCummulativeWorkflow') {
        let currentWorflowObj = {}
        let signedInCount = 0
        let consentedCount = 0
        let submittedProfileCount = 0
        let verificationCount = 0
        let verifiedCount = 0

        let signedIn = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.signedStatus === fieldMapping.yes))
              signedIn.forEach((i) => {
                signedInCount += i.signedCount
            })
        let consented = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.consentStatus === fieldMapping.yes))
             consented.forEach((i) => {
                consentedCount += i.consentCount
            })
        let submittedProfile = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && i.submittedStatus === fieldMapping.yes))
             submittedProfile.forEach((i) => {
                submittedProfileCount += i.submittedCount
            })
        let verification = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && (i.verificationStatus === fieldMapping.verified || i.verificationStatus === fieldMapping.cannotBeVerified || i.verificationStatus === fieldMapping.duplicate ) ))
             verification.forEach((i) => {
                verificationCount += i.verificationCount
            })
        
        let verified = data.filter(i => 
            ((i.recruitType === fieldMapping.active || fieldMapping.passive) && (i.verificationStatus === fieldMapping.verified ) ))
            verified.forEach((i) => {
                verifiedCount += i.verificationCount
            })
        currentWorflowObj.signedIn = signedInCount
        currentWorflowObj.consented = consentedCount
        currentWorflowObj.submittedProfile = submittedProfileCount
        currentWorflowObj.verification = verificationCount
        currentWorflowObj.verified = verifiedCount
        data = currentWorflowObj     
    }
    return data;
}

module.exports = {
    getTable
}