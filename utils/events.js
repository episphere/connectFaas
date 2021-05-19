const importToBigQuery = async (event, context) => {
    const gcsEvent = event;
    let tableName = ''
    if(gcsEvent.name.indexOf('.export_metadata') === -1) return true;
    if(gcsEvent.name.includes('participants')) tableName = 'participants';
    if(gcsEvent.name.includes('biospecimen')) tableName = 'biospecimen';
    console.log(`Processing file: ${gcsEvent.name}`);
    const url = `gs://connect_firestore_dev_backup/${gcsEvent.name}`;
    console.log(url)
    const {BigQuery} = require('@google-cloud/bigquery');
    const {Storage} = require('@google-cloud/storage');
    const storage = new Storage();
    const bigquery = new BigQuery();
  
    const datasetId = 'Connect';
    const tableId = tableName;
    const bucketName = 'connect_firestore_dev_backup';
  
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
        .load(storage.bucket(bucketName).file(gcsEvent.name), metadata);
  
    // load() waits for the job to finish
    console.log(`Load job ${job.id} completed.`);
  
    // Check the job's status for errors
    const errors = job.status.errors;
    if (errors && errors.length > 0) {
        throw errors;
    }
};

module.exports = {
    importToBigQuery
}