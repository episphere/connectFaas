const firestore = require('@google-cloud/firestore');
const {BigQuery} = require('@google-cloud/bigquery');
const {Storage} = require('@google-cloud/storage');

const collectionNameList = ['participants','biospecimen', 'boxes', 'module1_v1', 'module1_v2', 'module2_v1', 'module2_v2', 'module3_v1', 'module4_v1', 'bioSurvey_v1', 'menstrualSurvey_v1', 'clinicalBioSurvey_v1','covid19Survey_v1'];

const importToBigQuery = async (event, context) => {
    const gcsEvent = event;
    let tableName = ''
    if (gcsEvent.name.indexOf('.export_metadata') === -1) return true;
    for (const collectionName  of collectionNameList) {
        if (gcsEvent.name.includes(collectionName)) {
            tableName = collectionName;
            break;
        }
    }

    console.log(`Processing file: ${gcsEvent.name}`);
    const gcsBucket = process.env.GCLOUD_BUCKET;
    const url = `gs://${gcsBucket}/${gcsEvent.name}`;
    console.log(url)
    const storage = new Storage();
    const bigquery = new BigQuery();
  
    const datasetId = 'Connect';
    const tableId = tableName;
  
    const metadata = {
      sourceFormat: 'DATASTORE_BACKUP',
      // projectionFields: ['371067537', 'pin', '494982282', '564964481', '142654897', 'Module1', 'query'],
      createDisposition: 'CREATE_IF_NEEDED',
      writeDisposition: 'WRITE_TRUNCATE',
      location: 'US',
    };
  
    const [job] = await bigquery
        .dataset(datasetId)
        .table(tableId)
        .load(storage.bucket(gcsBucket).file(gcsEvent.name), metadata);
  
    // load() waits for the job to finish
    console.log(`Load job ${job.id} completed.`);
  
    // Check the job's status for errors
    const errors = job.status.errors;
    if (errors && errors.length > 0) {
        throw errors;
    }
};

const firestoreExport = async (event, context) => {
    const client = new firestore.v1.FirestoreAdminClient();
    const gcsBucket = process.env.GCLOUD_BUCKET;
    console.log(gcsBucket)
    const bucket = `gs://${gcsBucket}`;
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    console.log(projectId)
    const databaseName = client.databasePath(projectId, '(default)');

    await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        collectionIds: collectionNameList,
    });

    return true;
};

const exportNotificationsToBucket = async (event, context) => {
  const client = new firestore.v1.FirestoreAdminClient();
  const gcsBucket = process.env.GCLOUD_BUCKET;
  const bucket = `gs://${gcsBucket}`;
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  const databaseName = client.databasePath(projectId, "(default)");

  await client.exportDocuments({
    name: databaseName,
    outputUriPrefix: bucket,
    collectionIds: ["notifications"],
  });
  console.log(`Exported notifications to bucket ${gcsBucket}`);
};

const importNotificationsToBigquery = async (event, context) => {
  const gcsEvent = event;
  if (!gcsEvent.name.includes(".export_metadata") || !gcsEvent.name.includes("notifications")) return;
  const gcsBucket = process.env.GCLOUD_BUCKET;
  const datasetId = "Connect";
  let tableId = "notifications";
  console.log(`Processing file: ${gcsEvent.name}`);

  const storage = new Storage();
  const bigquery = new BigQuery();
  const metadata = {
    sourceFormat: "DATASTORE_BACKUP",
    createDisposition: "CREATE_IF_NEEDED",
    writeDisposition: "WRITE_TRUNCATE",
    location: "US",
  };

  const [job] = await bigquery
    .dataset(datasetId)
    .table(tableId)
    .load(storage.bucket(gcsBucket).file(gcsEvent.name), metadata);

  console.log("Imported notifications to BigQuery.");

  // Check the job's status for errors
  const errors = job.status.errors;
  if (errors && errors.length > 0) {
    throw errors;
  }
};

module.exports = {
    importToBigQuery,
    firestoreExport,
    exportNotificationsToBucket,
    importNotificationsToBigquery,
};
