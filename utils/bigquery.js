const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();


const getTable = async (tableName, isParent, siteCode) => {
    const dataset = bigquery.dataset('stats');
    const [tableData] = await dataset.table(tableName).getRows();
    let data = '';

    if(isParent) data = tableData.filter(dt => siteCode.indexOf(dt.siteCode) !== -1)
    else data = tableData.filter(dt => dt.siteCode === siteCode)
  
    return data;
}

module.exports = {
    getTable
}