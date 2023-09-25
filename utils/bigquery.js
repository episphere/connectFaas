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
  timeField = "",
  fieldsToFetch = [],
  limit = 100,
  offset = 0,
}) {
  let result = {hasNext: false, fetchedDataArray: []};
  if (!notificationSpecId || Object.keys(conditions).length === 0) return result;

  const bqNotificationSpecId = notificationSpecId.replace(/-/g, "_").replace(/^(\d)/, "d_$1");
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

  if (cutoffTimeStr && timeField) {
    const bqTimeField = convertToBigqueryKey(timeField);
    bqConditionArray.push(`${bqTimeField} <= "${cutoffTimeStr}"`);
  }

  const queryStrCommon = `SELECT ${
    bqFieldArray.length === 0 ? "*" : bqFieldArray.join(", ")
  } FROM \`Connect.participants\` WHERE ${bqConditionArray.join(" AND ")}`;

  try {
    const queryStr = `${queryStrCommon} AND query.notificationSpecIdsUsed.${bqNotificationSpecId} IS NOT true LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await bigquery.query(queryStr);
    if (rows.length === 0) return result;

    result.hasNext = rows.length === limit;
    result.fetchedDataArray = rows.map(convertToFirestoreData);
  } catch (error) {
    // Error occurs on missing field(s) in BQ table.
    if (error.message.includes(`Field name ${bqNotificationSpecId} does not exist`)) {
      try {
        const queryStr = `${queryStrCommon} LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await bigquery.query(queryStr);
        if (rows.length === 0) return result;

        result.hasNext = rows.length === limit;
        result.fetchedDataArray = rows.map(convertToFirestoreData);
      } catch (err) {
        console.log(`getParticipantsForNotificationsBQ() error running spec ID ${notificationSpecId}.`, err);
      }
    } else {
      console.log(`getParticipantsForNotificationsBQ() error running spec ID ${notificationSpecId}.`, error);
    }
  }

  return result;
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

module.exports = {
    getTable,
    getParticipantsForNotificationsBQ,
    getStatsFromBQ,
};