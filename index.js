const { validateSiteUsers, getToken } = require('./utils/validation');
const { getParticipants, identifyParticipant } = require('./utils/submission');
const { submitParticipantsData, updateParticipantData } = require('./utils/sites');
const { notificationHandler } = require('./utils/notifications');
const { connectApp } = require('./utils/connectApp');
const { biospecimenAPIs } = require('./utils/biospecimen');
const { incentiveCompleted, eligibleForIncentive } = require('./utils/incentive');
const { stats } = require('./utils/stats');
const { dashboard } = require('./utils/dashboard');
const { getParticipantNotification } = require('./utils/notifications');
const { importToBigQuery, firestoreExport } = require('./utils/events');
const { consistencyCheck } = require('./utils/qcDataChecks');
const { removeParticipantsDataDestruction } = require('./utils/shared')
const { removeUninvitedParticipantsAPI } = require('./utils/shared')

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

exports.removeParticipantsDataDestruction = removeParticipantsDataDestruction

exports.removeUninvitedParticipantsAPI = removeUninvitedParticipantsAPI

// For Connect App

exports.app = connectApp;

// Biospecimen

exports.biospecimen = biospecimenAPIs;

exports.sendEmailNotification = notificationHandler

const getAccessTokenForSA = async () => {
    const {google} = require("googleapis");
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
