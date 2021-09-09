const { validateToken, validateSiteUsers, getToken, generateToken } = require('./utils/validation');
const { recruitSubmit, getParticipants, identifyParticipant, getUserProfile } = require('./utils/submission');
const { submitParticipantsData, updateParticipantData } = require('./utils/sites');
const { deleteDocuments } = require('./utils/shared');
const { subscribeToNotification, retrieveNotifications, notificationHandler, storeNotificationSchema } = require('./utils/notifications');
const { connectApp } = require('./utils/connectApp');
const { biospecimenAPIs } = require('./utils/biospecimen');
const { incentiveCompleted, eligibleForIncentive } = require('./utils/incentive');
const { stats } = require('./utils/stats');
const { dashboard } = require('./utils/dashboard');
const { getParticipantNotification } = require('./utils/notifications');
const { importToBigQuery, firestoreExport } = require('./utils/events');
const { consistencyCheck } = require('./utils/qcDataChecks');

// For NORC Incentive

exports.incentiveCompleted = incentiveCompleted;

exports.participantsEligibleForIncentive = eligibleForIncentive;

// For Sites

exports.getParticipantToken = getToken;

exports.getParticipants = getParticipants;

exports.validateSiteUsers = validateSiteUsers;

exports.identifyParticipant = identifyParticipant;

exports.submitParticipantsData = submitParticipantsData;

exports.updateParticipantData = updateParticipantData;

exports.stats = stats;

exports.getParticipantNotification = getParticipantNotification;

exports.dashboard = dashboard;

exports.consistencyCheck = consistencyCheck

// For Connect App

exports.generateToken = generateToken;

exports.validateToken = validateToken;

exports.submit = recruitSubmit;

exports.getUserProfile = getUserProfile;

exports.subscribeToNotification = subscribeToNotification;

exports.retrieveNotifications = retrieveNotifications;

exports.deleteDocuments = deleteDocuments;

exports.app = connectApp;

// Biospecimen

exports.biospecimen = biospecimenAPIs;

exports.sendEmailNotification = notificationHandler

const getAccessTokenForSA = async () => {
    const serviceAccount = require(process.env.GCP_SA);

    const scopes = ["https://www.googleapis.com/auth/userinfo.email"];

    const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        null,
        serviceAccount.private_key,
        scopes
    );

    try {
        const tokens = await jwtClient.authorize();
        const accessToken = tokens.access_token;
        if(accessToken === null) return console.log("Provided service account does not have permission to generate access tokens");
        return accessToken;
    } 
    catch (error) {
        console.log(error)
    };
}

exports.importToBigQuery = importToBigQuery;
  
exports.scheduleFirestoreDataExport = firestoreExport;
