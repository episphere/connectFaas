const { validate, validateToken, getKey } = require('./utils/validation');
const { submit } = require('./utils/submission');
const { getQuestionnaire } = require('./utils/questionnaire');

exports.validate = validate;
 
exports.validateToken = validateToken;

exports.getKey = getKey;

exports.submit = submit;

exports.getQuestionnaire = getQuestionnaire;
