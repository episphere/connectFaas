const Busboy = require('busboy');
const { setHeaders, getResponseJSON } = require('./shared');

// const { Storage } = require('@google-cloud/storage');
// const storage = new Storage({
//     keyFilename: `${__dirname}/../nih-nci-dceg-episphere-dev-70e8e321d62d.json`
// });
// const bucket = storage.bucket('connect4cancer');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const storage = admin.storage();
const bucket = storage.bucket('connect4cancer');

const uploadHealthRecords = (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'POST') {
        return res.status(405).json(getResponseJSON('Only POST requests are accepted!', 405));
    }
    const busboy = new Busboy({headers: req.headers});
    busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
        const blob = bucket.file(filename);
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