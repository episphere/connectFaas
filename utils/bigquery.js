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

  const dotPlaceholder = "_DOT_"; // holds locations of "." during BQ query
  const bqFieldArray = fieldsToFetch
    .map(convertToBigqueryKey)
    .map((field) => `${field} AS ${field.replaceAll(".", dotPlaceholder)}`);
  const queryStr = `SELECT ${bqFieldArray.length === 0 ? "*" : bqFieldArray.join(", ")} 
    FROM \`Connect.participants\` 
    WHERE ${bqConditionArray.join(" AND ")} 
    AND query.notificationSpecIdsUsed.${bqNotificationSpecId} IS NOT true 
    LIMIT ${limit} OFFSET ${offset}`;

  try {
    const [rows] = await bigquery.query(queryStr);
    if (rows.length === 0) return result;

    result.hasNext = rows.length === limit;
    result.fetchedDataArray = rows.map((data) => convertToFirestoreData(data, dotPlaceholder));
    return result;
  } catch (error) {
    throw new Error("getParticipantsForNotificationsBQ() error.", {cause: error});
  }
}

/**
 * Unflatten and convert to firestore data format
 * @param {object} bqData data from BQ
 * @param {string} dotPlaceholder placeholder of "." in keys during BQ query
 * @returns
 */
function convertToFirestoreData(bqData, dotPlaceholder) {
  let result = {};
  let keySet = new Set();

  for (const [bqKey, val] of Object.entries(bqData)) {
    if (val === null) continue;
    const longKey = convertToFirestoreKey(bqKey).replaceAll(dotPlaceholder, ".");
    if (!longKey.includes(".")) {
      if (typeof val === "object" && !Array.isArray(val)) {
        result[longKey] = convertToFirestoreData(val, dotPlaceholder);
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
    result[key] = convertToFirestoreData(result[key], dotPlaceholder);
  }

  return result;
}

function convertToBigqueryKey(str) {
  return str.replace(/(?<=^|\.)(\d)/g, "d_$1");
}

function convertToFirestoreKey(str) {
  return str.replace(/(?<=^|\.)d_(\d)/g, "$1");
}

module.exports = {
    getTable,
    getParticipantsForNotificationsBQ,
};
