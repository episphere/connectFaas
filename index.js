const { validate, validateToken, getKey, validateSiteUsers, validateUserSession, getToken, confluence, generateToken } = require('./utils/validation');
const { recruitSubmit, getParticipants, identifyParticipant, participantData, getUserProfile } = require('./utils/submission');
const { getQuestionnaire } = require('./utils/questionnaire');
const { getSiteDetails, submitParticipantsData, updateParticipantData } = require('./utils/sites');
const { setHeaders, deleteDocuments } = require('./utils/shared');
const { subscribeToNotification, retrieveNotifications } = require('./utils/notifications');
const { uploadHealthRecords } = require('./utils/upload');
const { connectApp } = require('./utils/connectApp');
const { biospecimenAPIs } = require('./utils/biospecimen');
const { encryptAsymmetric } = require('./utils/encrypt');
const { incentiveCompleted, eligibleForIncentive } = require('./utils/incentive')

exports.incentiveCompleted = incentiveCompleted

exports.participantsEligibleForIncentive = eligibleForIncentive;

exports.validate = validate;

exports.generateToken = generateToken;

exports.validateToken = validateToken;

exports.getParticipantToken = getToken;

exports.getKey = getKey;

exports.getQuestionnaire = getQuestionnaire;

exports.submit = recruitSubmit;

exports.getUserProfile = getUserProfile;

exports.getParticipants = getParticipants;

exports.validateSiteUsers = validateSiteUsers;

exports.identifyParticipant = identifyParticipant;

exports.submitParticipantsData = submitParticipantsData;

exports.updateParticipantData = updateParticipantData;

exports.subscribeToNotification = subscribeToNotification;

exports.retrieveNotifications = retrieveNotifications;

exports.uploadHealthRecords = uploadHealthRecords;

exports.getSiteDetails = getSiteDetails;

exports.validateUserSession = validateUserSession;

exports.confluence = confluence;

exports.deleteDocuments = deleteDocuments;

exports.app = connectApp;

exports.biospecimen = biospecimenAPIs;

// exports.encrypt = encryptAsymmetric;

exports.sendEmailNotification = (req, res) => {
    setHeaders(res);
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey('');
    const msg = {
        to: 'bhaumik55231@gmail.com',
        from: 'connect@example.com',
        subject: 'Thanks for participating in Connect Cohort Study',
        text: 'Thanks for participating in Connect Cohort Study',
        html: '<strong>Connect Support Team</strong>',
      };
    sgMail.send(msg);
    res.status(200).json({code:200, message: 'ok'})
}
