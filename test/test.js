const assert = require('assert');
const Supertest = require('supertest');
const supertest = Supertest('https://us-central1-nih-nci-dceg-episphere-dev.cloudfunctions.net');
const bearerToken = 'Bearer ';

describe('getParticipantToken API: -', () => {
    const endPoint = '/getParticipantToken';
    it(`${endPoint}: should return 405`, async () => {
        await supertest
        .get(endPoint)
        .expect(405);
    });
    it(`${endPoint}: should return 401`, async () => {
        await supertest
        .post(endPoint)
        .expect(401);
    });
    it(`${endPoint}: should return 400`, async () => {
        await supertest
        .post(endPoint)
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(400);
    });
    const requestArray = [{"studyId": 'NCI-ajsr76'}, {"studyId": 'NCI-ajwdar76'}];
    it(`${endPoint}: should return 200`, async () => {
        await supertest
        .post(endPoint)
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .send({"data": requestArray})
        .expect(200)
        .expect(response => {
            assert.equal(Array.isArray(response.body.data), true);
            assert.equal(response.body.data.length, requestArray.length);
        });
    });
});

describe('getParticipants API: -', () => {
    const endPoint = '/getParticipants';
    it(`${endPoint}: should return 405`, async () => {
        await supertest
        .post(endPoint)
        .expect(405);
    });
    it(`${endPoint}: should return 401`, async () => {
        await supertest
        .get(endPoint)
        .expect(401);
    });
    it(`${endPoint}: should return 404`, async () => {
        await supertest
        .get(endPoint)
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(404);
    });
    it(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=all')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
    it(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=verified')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
    it(`${endPoint}: should return 200`, async () => {
        await supertest
        .get(endPoint+'?type=notyetverified')
        .set('Authorization', bearerToken)
        .set('Content-Type', 'application/json')
        .expect(200);
    });
});