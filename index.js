const { validateToken, validateSiteUsers, getToken, generateToken } = require('./utils/validation');
const { recruitSubmit, getParticipants, identifyParticipant, getUserProfile } = require('./utils/submission');
const { submitParticipantsData, updateParticipantData } = require('./utils/sites');
const { deleteDocuments } = require('./utils/shared');
const { subscribeToNotification, retrieveNotifications, notificationHandler } = require('./utils/notifications');
const { connectApp } = require('./utils/connectApp');
const { biospecimenAPIs } = require('./utils/biospecimen');
const { encryptAsymmetric } = require('./utils/encrypt');
const { incentiveCompleted, eligibleForIncentive } = require('./utils/incentive')

// For NORC Incentive

exports.incentiveCompleted = incentiveCompleted; // new auth done

exports.participantsEligibleForIncentive = eligibleForIncentive; // new auth done

// For Sites

exports.getParticipantToken = getToken; // new auth done

exports.getParticipants = getParticipants; // new auth done

exports.validateSiteUsers = validateSiteUsers; // new auth done

exports.identifyParticipant = identifyParticipant; // new auth done

exports.submitParticipantsData = submitParticipantsData; // new auth done

exports.updateParticipantData = updateParticipantData; // new auth done

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

// exports.encrypt = encryptAsymmetric;

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
