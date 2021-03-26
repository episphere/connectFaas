const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();


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

    if (status === 'participantsRecruitsCount') {
        return data;
    }

    if (status === 'participantsWorkflow'){
        return data;
    }

    if (status === 'participantsVerification') {
        return data;
    }
  
    return data;
}

module.exports = {
    getTable
}