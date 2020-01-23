const { validate, validateToken, getKey, validateSiteUsers, validateUserSession, getToken, confluence, generateToken } = require('./utils/validation');
const { recruitSubmit, getParticipants, identifyParticipant, getUserProfile, createAccount, login } = require('./utils/submission');
const { getQuestionnaire } = require('./utils/questionnaire');
const { getSiteDetails } = require('./utils/sites');
const { setHeaders } = require('./utils/shared');

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

exports.getSiteDetails = getSiteDetails;

exports.createAccount = createAccount;

exports.login = login;

exports.validateUserSession = validateUserSession;

exports.confluence = confluence;

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
