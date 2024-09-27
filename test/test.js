const assert = require('assert');
const Supertest = require('supertest');
const supertest = Supertest('http://localhost:5001/nih-nci-dceg-connect-dev/us-central1/app?api=');
const bearerToken = 'Bearer ';
const admin = require('firebase-admin');
const uuid = require('uuid');
const firestore = require('../utils/firestore');
const validation = require('../utils/validation');
const functions = require('../index');
const submission = require('../utils/submission');
const serviceAccount = require('../nih-nci-dceg-connect-dev-4a660d0c674e'); 
const sinon = require('sinon');
const httpMocks = require('node-mocks-http');
const conceptIds = require('../utils/fieldToConceptIdMapping.js');
// admin.initializeApp({credential: admin.credential.cert(serviceAccount)}); 
// admin.auth().createUser() // Create a temporary user

// @TODO: Can I use sinon to mock out validateIDToken with something that will validate my fake  tokens and just skip this?
// That would just make my life so much easier.

// Set FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099" (or port used) environment variable to connect to running auth emulator
// Set export FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000" (or port used) environment variable to connect to running FireStore DB emulator
// Set export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080" (or port used) enviroment variable to connect to running Cloud Firestore emulator
// Set 

async function getSession() {
    // const url = await firestore.generateSignInWithEmailLink('ablaylock@emmes.com', 'https://localhost:5000');
    // console.log('url', url);
    // return url;
}



describe('incentiveCompleted', async () => {
    it.only('Should return 200 for options', async () => {
        const req = httpMocks.createRequest({
            method: 'OPTIONS',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.incentiveCompleted(req, res)
        assert.equal(res.statusCode, 200);
        const data = res._getJSONData();
        assert.equal(data.code, 200);
    });
    it.only('Should only accept POST', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.incentiveCompleted(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only POST requests are accepted!');
        assert.equal(data.code, 405);
    });
});

describe('participantsEligibleForIncentive', async () => {
    it('Should return 200 for options', async () => {
        const req = httpMocks.createRequest({
            method: 'OPTIONS',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.participantsEligibleForIncentive(req, res)
        assert.equal(res.statusCode, 200);
        const data = res._getJSONData();
        assert.equal(data.code, 200);
    });
    it('Should only accept GET', async () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.incentiveCompleted(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only GET requests are accepted!');
        assert.equal(data.code, 405);
    });
});

describe.skip('getParticipantToken', async () => {
    it('Should return 200 for options', async () => {
        const req = httpMocks.createRequest({
            method: 'OPTIONS',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getParticipantToken(req, res)
        assert.equal(res.statusCode, 200);
        const data = res._getJSONData();
        assert.equal(data.code, 200);
    });
    it('Should only accept POST', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getParticipantToken(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only POST requests are accepted!');
        assert.equal(data.code, 405);
    });
    it('Should generate a user', async () => {
        const uid = uuid.v4();
        const req = httpMocks.createRequest({
            method: 'GET',
            query: {
                email: 'test3@team617106.testinator.com'
            },
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        functions.getParticipantToken(req, res)
            .then(() => {
                console.log('statusCode', res.statusCode);
                assert.equal(res.statusCode, 200);
                const data = res._getData();
                console.log('data', data);
            })
            .catch(console.error);
        
    });
});

describe.skip('validateUsersEmailPhone', () => {
    it('Should only accept GET', async () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.validateUsersEmailPhone(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only GET requests are accepted!');
        assert.equal(data.code, 405);
    });
    it('Should find a user', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            query: {
                email: 'test3@team617106.testinator.com'
            },
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
        const res = httpMocks.createResponse();
        await functions.validateUsersEmailPhone(req, res);

        assert.equal(res.statusCode, 200);
        const {data, code} = res._getJSONData();
        assert.equal(code, 200);
        assert.equal(data.accountExists, true); 
    });
    it('Should NOT find a user', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            query: {
                email: 'nonexistent@team617106.testinator.com'
            },
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
        const res = httpMocks.createResponse();
        await functions.validateUsersEmailPhone(req, res);

        assert.equal(res.statusCode, 200);
        const {data, code} = res._getJSONData();
        assert.equal(code, 200);
        assert.equal(data.accountExists, false); 
    });
});

describe('getFilteredParticipants', async () => {
    it('Should return 200 for options', async () => {
        const req = httpMocks.createRequest({
            method: 'OPTIONS',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getFilteredParticipants(req, res)
        assert.equal(res.statusCode, 200);
        const data = res._getJSONData();
        assert.equal(data.code, 200);
    });
    it('Should only accept GET', async () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getFilteredParticipants(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only GET requests are accepted!');
        assert.equal(data.code, 405);
    });
});

describe('getParticipants', () => {
    it('Should return 200 for options', async () => {
        const req = httpMocks.createRequest({
            method: 'OPTIONS',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getParticipants(req, res)
        assert.equal(res.statusCode, 200);
        const data = res._getJSONData();
        assert.equal(data.code, 200);
    });
    it('Should only accept GET', async () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.getParticipants(req, res)
        assert.equal(res.statusCode, 405);
        const data = res._getJSONData();
        assert.equal(data.message, 'Only GET requests are accepted!');
        assert.equal(data.code, 405);
    });
    it('Parent should find participants for all sites', async () => {
        const siteCodes = Object.keys(conceptIds.siteLoginMap).map(key => conceptIds.siteLoginMap[key]);
        const req = httpMocks.createRequest({
            method: 'GET',
            query: {
                type: 'all',
                siteCodes
            },
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        const authObj = {
            isParent: true,
            siteCodes
        };
        await functions.getParticipants(req, res, authObj);
        assert.equal(res.statusCode, 200);
        const {data, code, limit, dataSize} = res._getJSONData();
        assert.equal(code, 200);
        assert.equal(data.length, dataSize);
        assert.equal(limit, 100);
        assert.equal(dataSize > 0, true);
    });
    it('Non-parent should find participants for NIH site', async () => {
        const siteCodes = Object.keys(conceptIds.siteLoginMap).map(key => conceptIds.siteLoginMap[key]);
        const req = httpMocks.createRequest({
            method: 'GET',
            query: {
                type: 'all',
                siteCode: 13
            },
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        const authObj = {
            isParent: false,
            siteCodes: 13
        };
        await functions.getParticipants(req, res, authObj);
        assert.equal(res.statusCode, 200);
        const {data, code, limit, dataSize} = res._getJSONData();
        assert.equal(code, 200);
        assert.equal(data.length, dataSize);
        assert.equal(limit, 100);
        assert.equal(dataSize > 0, true);
    });
});

describe('identifyParticipant', async () => {

});

describe('submitParticipantsData', async () => {

});

describe('updateParticipantData', async () => {

});

describe('getParticipantNotification', async () => {

});

describe('dashboard', async () => {

});

describe('app', async () => {

});

describe('biospecimen', async () => {

});

describe('sendScheduledNotificationsGen2', async () => {

});

describe('importToBigQuery', async () => {

});

describe('scheduleFirestoreDataExport', async () => {

});

describe('exportNotificationsToBucket', async () => {

});

describe('importNotificationsToBigquery', async () => {

});

describe('participantDataCleanup', async () => {

});

describe('webhook', async () => {

});

describe.skip('heartbeat', async () => {
    it('Should allow get', async() => {
        const req = httpMocks.createRequest({
            method: 'GET',
            headers: {
                'x-forwarded-for': 'dummy'
            },
            connection: {}
        });
    
        const res = httpMocks.createResponse();
        await functions.heartbeat(req, res);
    });
});

describe.skip('Log in', () => {
    // const auth = admin.auth();
    // sinon.replaceGetter(admin, 'auth', () => auth);
    // sinon.replace(auth, 'verifyIdToken', (idToken) => {
    //     console.log('Override attempted');
    //     return {uid: uuid.v4()};
    // });
    // it.skip('validateUsersEmailPhone', async () => {
    //     const uid = uuid.v4();
    //     const idToken = await auth.createCustomToken(uid);
    //     await supertest
    //         .get('validateEmailOrPhone&email=test3@team617106.testinator.com')
    //         .set('Authorization', bearerToken + idToken)
    //         .expect(200);
    // });
    // it.skip('Generate email', async () => {
    //     const url = await getSession();
    // });
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