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

const stringToOperatorConvt = {
  equals: "=",
  notequals: "!=",
  greater: ">",
  greaterequals: ">=",
  less: "<",
  lessequals: "<=",
};

/**
 * Get participant data fields from BigQuery, based on conditions.
 */
async function getParticipantsForNotificationsBQ({
  notificationSpecId = "",
  conditions = {},
  cutoffTimeStr = "",
  stopTimeStr = "",
  timeField = "",
  fieldsToFetch = [],
  limit = 100,
  previousConnectId = 0,
}) {
  if (!notificationSpecId || Object.keys(conditions).length === 0) return [];

  const bqFieldArray = fieldsToFetch
    .map(convertToBigqueryKey)
    .map((field) => `${field} AS ${field.replace(/\./g, "_DOT_")}`);
  let bqConditionArray = [];

  for (const [key, val] of Object.entries(conditions)) {
    const [operatorStr, value] = Object.entries(val)[0];
    const operator = stringToOperatorConvt[operatorStr];
    if (!operator) continue;

    const bqKey = convertToBigqueryKey(key);
    bqConditionArray.push(`${bqKey} ${operator} ${typeof value === "number" ? value : `"${value}"`}`);
  }

  if (timeField) {
    const bqTimeField = convertToBigqueryKey(timeField);
    if (cutoffTimeStr) bqConditionArray.push(`${bqTimeField} <= "${cutoffTimeStr}"`);
    if (stopTimeStr) bqConditionArray.push(`${bqTimeField} >= "${stopTimeStr}"`);
  }

  const queryStr = `SELECT ${bqFieldArray.length === 0 ? "token" : bqFieldArray.join(", ")}
    FROM \`Connect.participants\` 
    LEFT JOIN (
      SELECT DISTINCT token, TRUE AS isSent
      FROM
        \`Connect.notifications\`
      WHERE
        notificationSpecificationsID = "${notificationSpecId}")
    USING (token)
    WHERE ${bqConditionArray.length === 0 ? "1=1" : bqConditionArray.join(" AND ")}
    AND isSent IS NULL AND Connect_ID > ${previousConnectId} ORDER BY Connect_ID LIMIT ${limit}`;

  const [rows] = await bigquery.query(queryStr);
  if (rows.length === 0) return [];

  return rows.map(convertToFirestoreData);
}

/**
 * Unflatten and convert to firestore data format
 * @param {object} bqData data from BQ
 * @returns
 */
function convertToFirestoreData(bqData) {
  let result = {};
  let keySet = new Set();

  for (const [bqKey, val] of Object.entries(bqData)) {
    if (val === null) continue;
    const longKey = convertToFirestoreKey(bqKey).replace(/_DOT_/g, ".");
    if (!longKey.includes(".")) {
      if (typeof val === "object" && !Array.isArray(val)) {
        result[longKey] = convertToFirestoreData(val);
        continue;
      }

      result[longKey] = val;
      continue;
    }

    const [currKey, ...restKeys] = longKey.split(".");
    keySet.add(currKey);
    result[currKey] = result[currKey] || {};
    result[currKey][restKeys.join(".")] = val;
  }

  for (const key of keySet) {
    result[key] = convertToFirestoreData(result[key]);
  }

  return result;
}

function convertToBigqueryKey(str) {
  return str.replace(/(?<=^|\.)(\d)/g, "d_$1");
}

function convertToFirestoreKey(str) {
  return str.replace(/(?<=^|\.)d_(\d)/g, "$1");
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
  
  let rows = [];
  try {
    [rows] = await bigquery.query(options);
  } catch (error) {
    console.error("getStatsFromBQ() error.", error);
  }
  
  return rows;
};

/**
 * 
 * @param {string} fullNumber Phone number in the format +11234567890
 * @returns {Promise<string[]>} Array of tokens of participant(s) having the phone number
 */
const getParticipantTokensByPhoneNumber = async (fullNumber) => {
  const tenDigitsNumber = fullNumber.slice(-10);
  const query = `SELECT token FROM \`Connect.participants\` WHERE d_348474836 = @fullNumber OR d_388711124 = @tenDigitsNumber`;
  const options = {
    query,
    location: "US",
    params: { fullNumber, tenDigitsNumber },
  };
  
  let rows = [];
  try {
    [rows] = await bigquery.query(options);
  } catch (error) {
    console.error("Error calling getParticipantTokensByPhoneNumber().", error);
  }
  
  return rows.map(row => row.token);
};

module.exports = {
    getTable,
    getParticipantsForNotificationsBQ,
    getStatsFromBQ,
    getParticipantTokensByPhoneNumber,
};
