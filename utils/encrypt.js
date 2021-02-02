const projectId = 'nih-nci-dceg-connect-dev';
const locationId = 'global';
const keyRingId = 'test-key';
const keyId = 'my-key';
const versionId = '1';
const plaintextBuffer = Buffer.from('123123121');

const { KeyManagementServiceClient } = require('@google-cloud/kms');

const client = new KeyManagementServiceClient();

const versionName = client.cryptoKeyVersionPath(
    projectId,
    locationId,
    keyRingId,
    keyId,
    versionId
);

const encryptAsymmetric = async () => {
    // Get public key from Cloud KMS
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

    console.log(`Ciphertext: ${ciphertextBuffer.toString('base64')}`);
    // decryptAsymmetric(ciphertextBuffer.toString('base64'))
    return ciphertextBuffer;
}

async function decryptAsymmetric(ciphertext) {
    const crc32c = require('fast-crc32c');
    const ciphertextCrc32c = crc32c.calculate(ciphertext);  
    const [decryptResponse] = await client.asymmetricDecrypt({
      name: versionName,
      ciphertext: ciphertext,
      ciphertextCrc32c: {
        value: ciphertextCrc32c,
      },
    });
  
    if (!decryptResponse.verifiedCiphertextCrc32c) {
      throw new Error('AsymmetricDecrypt: request corrupted in-transit');
    }
    if (
      crc32c.calculate(decryptResponse.plaintext) !==
      Number(decryptResponse.plaintextCrc32c.value)
    ) {
      throw new Error('AsymmetricDecrypt: response corrupted in-transit');
    }
  
    const plaintext = decryptResponse.plaintext.toString('utf8');
  
    console.log(`Plaintext: ${plaintext}`);
    return plaintext;
}

module.exports = {
    encryptAsymmetric
}