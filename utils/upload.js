const Busboy = require('busboy');
const { setHeaders, getResponseJSON } = require('./shared');

const uploadHealthRecords = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`validateSiteUser ${new Date()} ${siteKey}`);
    const { validateSiteUser } = require(`./firestore`);
    const authorize = await validateSiteUser(siteKey);

    if(authorize instanceof Error){
        return res.status(500).json(getResponseJSON(authorize.message, 500));
    }

    if(!authorize){
        return res.status(401).json(getResponseJSON('Authorization failed!', 401));
    }

    const siteId = authorize.id;
    const busboy = new Busboy({headers: req.headers});
    busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
        console.log(mimetype)
        const { getGCSbucket, storeUploadedFileDetails } = require('./firestore');
        const uuid = require('uuid');
        let fileType = '';
        if(mimetype === 'application/pdf') fileType = 'pdf';
        if(mimetype === 'text/plain') fileType = 'txt';
        if(mimetype === 'text/csv') fileType = 'csv';
        if(fileType === '') return res.status(400).json({message:'File type not supported', code:400});
        const newFileName = `${uuid()}${fileType !== '' ? `.${fileType}`:``}`;
        const obj = {siteId, originalFileName: filename, newFileName};
        storeUploadedFileDetails(obj);
        const blob = getGCSbucket().file(newFileName);
        const writeStream = blob.createWriteStream();
        file.pipe(writeStream)
            .on('data', function(data) {})
            .on('error', (err) => console.log(err))
            .on('end', () => {
                writeStream.end();
            });
    });

    busboy.on('finish', async () => {
        res.status(200).json({message:'success!', code:200});
    });
    busboy.end(req.rawBody);
}

module.exports = {
    uploadHealthRecords
}