const { getToken } = require('./utils/validation');
const { getParticipants, identifyParticipant } = require('./utils/submission');
const { submitParticipantsData, updateParticipantData } = require('./utils/sites');
const { notificationHandler } = require('./utils/notifications');
const { connectApp } = require('./utils/connectApp');
const { biospecimenAPIs } = require('./utils/biospecimen');
const { incentiveCompleted, eligibleForIncentive } = require('./utils/incentive');
const { dashboard } = require('./utils/dashboard');
const { getParticipantNotification } = require('./utils/notifications');
const { importToBigQuery, firestoreExport, exportNotificationsToBucket, importNotificationsToBigquery } = require('./utils/events');
const { participantDataCleanup } = require('./utils/participantDataCleanup');
const { sendGridEventWebhook } = require('./utils/sendGridEventWebhook');

// API End-Points for Sites

exports.incentiveCompleted = incentiveCompleted;

exports.participantsEligibleForIncentive = eligibleForIncentive;

exports.getParticipantToken = getToken;

exports.getParticipants = getParticipants;

exports.identifyParticipant = identifyParticipant;

exports.submitParticipantsData = submitParticipantsData;

exports.updateParticipantData = updateParticipantData;

exports.getParticipantNotification = getParticipantNotification;


// End-Point for Site Manager Dashboard

exports.dashboard = dashboard;


// End-Point for Connect PWA

exports.app = connectApp;


// End-Point for Biospecimen Dashboard

exports.biospecimen = biospecimenAPIs;


// End-Point for Email Notifications Handler

exports.sendEmailNotification = notificationHandler


// End-Points for Exporting Firestore to Big Query

exports.importToBigQuery = importToBigQuery;
  
exports.scheduleFirestoreDataExport = firestoreExport;

exports.exportNotificationsToBucket = exportNotificationsToBucket;
exports.importNotificationsToBigquery = importNotificationsToBigquery;

// End-Points for Participant Data Cleaning

exports.participantDataCleanup = participantDataCleanup

// End-Points for SendGrid Event Webhook

exports.sendGridEventWebhook = sendGridEventWebhook