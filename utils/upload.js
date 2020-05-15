const Busboy = require('busboy');
const { setHeaders, getResponseJSON } = require('./shared');

const uploadHealthRecords = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }

    const siteKey = req.headers.authorization.replace('Bearer','').trim();
    console.log(`uploadHealthRecords ${new Date()} ${siteKey}`);
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
        const fileExtension = filename.substr(filename.lastIndexOf('.'), filename.length);
        const { getGCSbucket, storeUploadedFileDetails } = require('./firestore');
        const uuid = require('uuid');
        const newFileName = `${uuid()}${fileExtension}`;
        const obj = {siteId, originalFileName: filename, newFileName, folder: authorize.acronym};
        storeUploadedFileDetails(obj);
        const blob = getGCSbucket().file(`${authorize.acronym}/${newFileName}`);
        const writeStream = blob.createWriteStream();
        file.pipe(writeStream)
            .on('data', () => {})
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