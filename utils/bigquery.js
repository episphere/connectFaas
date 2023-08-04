const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const getTable = async (tableName, isParent, siteCode) => {
    try {
        const dataset = bigquery.dataset('stats');
        const [tableData] = await dataset.table(tableName).getRows();
        let data = '';

        if(isParent) data = tableData.filter(dt => siteCode.indexOf(dt.siteCode) !== -1)
        else data = tableData.filter(dt => dt.siteCode === siteCode)
    
        return data;
    } catch (error) {
        if(/Not found: Table/i.test(error.message)) return [];
        else console.error(error)
    }
}

/**
 * @param {string} tableName
 * @param {number | number[]} siteCode
 */
const getStatsFromBQ = async (tableName, siteCode) => {
  const query = `SELECT * FROM \`stats.${tableName}\` WHERE siteCode IN UNNEST(@siteCode)`;
  const options = {
    query,
    location: "US",
    params: { siteCode: Array.isArray(siteCode) ? siteCode : [siteCode] },
  };
  const [rows] = await bigquery.query(options);
  
  return rows;
};

module.exports = {
    getTable,
    getStatsFromBQ
};
