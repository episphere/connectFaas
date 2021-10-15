const importToBigQuery = async (event, context) => {
    const gcsEvent = event;
    let tableName = ''
    if(gcsEvent.name.indexOf('.export_metadata') === -1) return true;
    if(gcsEvent.name.includes('participants')) tableName = 'participants';
    if(gcsEvent.name.includes('biospecimen')) tableName = 'biospecimen';
    if(gcsEvent.name.includes('boxes')) tableName = 'boxes';
    console.log(`Processing file: ${gcsEvent.name}`);
    const gcsBucket = process.env.GCLOUD_BUCKET;
    const url = `gs://${gcsBucket}/${gcsEvent.name}`;
    console.log(url)
    const {BigQuery} = require('@google-cloud/bigquery');
    const {Storage} = require('@google-cloud/storage');
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
    const firestore = require('@google-cloud/firestore');
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
        collectionIds: ['participants','biospecimen', 'boxes']
    });

    return true;
};


module.exports = {
    importToBigQuery,
    firestoreExport
}