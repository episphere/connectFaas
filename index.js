const { validate, validateToken, getKey, validateSiteUsers, validateUserSession, getToken } = require('./utils/validation');
const { recruitSubmit, getParticipants, identifyParticipant, getUserProfile, createAccount, login } = require('./utils/submission');
const { getQuestionnaire } = require('./utils/questionnaire');
const { getSiteDetails } = require('./utils/sites');

exports.validate = validate;
 
exports.validateToken = validateToken;

exports.getParticipantToken = getToken;

exports.getKey = getKey;

exports.getQuestionnaire = getQuestionnaire;

exports.recruit = recruitSubmit;

exports.getUserProfile = getUserProfile;

exports.getParticipants = getParticipants;

exports.validateSiteUsers = validateSiteUsers;

exports.identifyParticipant = identifyParticipant;

exports.getSiteDetails = getSiteDetails;

exports.createAccount = createAccount;

exports.login = login;

exports.validateUserSession = validateUserSession;

exports.hellocloud4biobhaumik = (req, res) => {
    let message = req.query.message || req.body.message || `Hello DCEG - ${Date()}`;
    res.status(200).json({data: message});
}