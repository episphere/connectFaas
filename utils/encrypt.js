const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
const locationId = 'global';
const keyRingId = 'Connect-SSN-Asymmetric-Key';
const keyId = 'asymmetric-key';
const versionId = '1';

const { KeyManagementServiceClient } = require('@google-cloud/kms');

const client = new KeyManagementServiceClient();

const encryptAsymmetric = async (data) => {
    const plaintextBuffer = Buffer.from(data);
    // Get public key from Cloud KMS
    const versionName = client.cryptoKeyVersionPath(
        projectId,
        locationId,
        keyRingId,
        keyId,
        versionId
    );
    const [publicKey] = await client.getPublicKey({
        name: versionName,
    });
    const crc32c = require('fast-crc32c');
    if (publicKey.name !== versionName) {
        throw new Error('GetPublicKey: request corrupted in-transit');
    }
    if (crc32c.calculate(publicKey.pem) !== Number(publicKey.pemCrc32c.value)) {
        throw new Error('GetPublicKey: response corrupted in-transit');
    }

    const crypto = require('crypto');
    const ciphertextBuffer = crypto.publicEncrypt({
            key: publicKey.pem,
            oaepHash: 'sha256',
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        plaintextBuffer
    );
    const ciphertext = ciphertextBuffer.toString('base64');
    return ciphertext;
}

module.exports = {
    encryptAsymmetric
}