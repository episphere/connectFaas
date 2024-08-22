const assert = require('assert');
const Supertest = require('supertest');
const supertest = Supertest('http://localhost:5001/nih-nci-dceg-connect-dev/us-central1/app?api=');
const bearerToken = 'Bearer ';
const admin = require('firebase-admin');
const uuid = require('uuid');
const firestore = require('../utils/firestore');
const functions = require('../functions/index');
const serviceAccount = require('../nih-nci-dceg-connect-dev-4a660d0c674e'); 
// admin.initializeApp({credential: admin.credential.cert(serviceAccount)}); 

// Set FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099" (or port used) environment variable to connect to running auth emulator
// Set export FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000" (or port used) environment variable to connect to running FireStore DB emulator
// Set export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080" (or port used) enviroment variable to connect to running Cloud Firestore emulator
// Set 

async function getSession() {
    const url = await firestore.generateSignInWithEmailLink('ablaylock@emmes.com', 'https://localhost:5000');
    console.log('url', url);
    return url;
}

describe('Log in', () => {
    it('validateUsersEmailPhone', async () => {
        firestore.validateUsersEmailPhone({
            method: 'GET',
            query: {}
        }, {
            status: () => ({json: () => {}})
        })
    });
    it('Generate email', async () => {
        const url = await getSession();
    });
});

describe.skip('generateToken API: -', () => {
    const endPoint = 'generateToken';
    const uid = uuid.v4();

    it(`${endPoint}: should return 405`, async () => {
        const idToken = await admin.auth().createCustomToken(uid);
        const idToken2 = admin.auth().idToken;
        console.log('idToken2', idToken2);
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        console.log('decodedToken', decodedToken);

        await supertest
            .post(endPoint)
            .set('Authorization', bearerToken + idToken)
            .set('Content-Type', 'application/json')
            .expect(405);
    });

    // First creation should succeed
    it(`${endPoint}: should return 200`, async () => {
        const idToken = await admin.auth().createCustomToken(uid);

        await supertest
            .get(endPoint)
            .set('Authorization', bearerToken + idToken)
            .set('Content-Type', 'application/json')
            .expect(200);
    });
    
    // Second attempt should result in duplicate data error

    it(`${endPoint}: should return 401`, async () => {
        const idToken = await admin.auth().createCustomToken(uid);

        await supertest
            .get(endPoint)
            .set('Authorization', bearerToken + idToken)
            .set('Content-Type', 'application/json')
            .expect(401);
    });
});

describe.skip('getParticipants API: -', () => {
    const endPoint = '/getParticipants';
    it.skip(`${endPoint}: should return 405`, async () => {
        await supertest
        .post(endPoint)
        .expect(405);
    });
    it.skip(`${endPoint}: should return 401`, async () => {
        await supertest
        .get(endPoint)
        .expect(401);
    });
    it.skip(`${endPoint}: should return 404`, async () => {
        await supertest
        .get(endPoint)
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(404);
    });
    it.skip(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=all')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
    it.skip(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=verified')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
    it.skip(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=notyetverified')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
});