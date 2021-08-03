

const templates = {
    "773707518": {
        "email": {
            "body": `Hello Connect site,<br/><br/>A participant at your site has revoked their HIPAA authorization to share medical records with the Connect for Cancer Prevention Study.<br/><br/>
            * Participant Connect ID: <Connect_ID><br/><br/>
            Please email [ConnectCC@nih.gov](mailto:connectcc@nih.gov) to confirm that you have received this notification and follow your site-specific Withdrawal SOP for handling this request.<br/><br/> If you have any questions, please contact the Connect Coordinating Center via [ConnectCC@nih.gov](mailto:connectcc@nih.gov) or (240) 276-5800.<br/><br/>Sincerely,<br/>the Connect team`,
            "subject": 'Notice: Connect Revocation Requested'
        }
    },
    "747006172": {
        "email": {
            "body": `Hello Connect site,<br/><br/>A participant at your site has withdrawn from the Connect for Cancer Prevention Study and revoked their HIPAA authorization to share medical records with Connect.<br/><br/>
            * Participant Connect ID: <Connect_ID><br/><br/>
            Please email [ConnectCC@nih.gov](mailto:connectcc@nih.gov) to confirm that you have received this notification and follow your site-specific Withdrawal SOP for handling this request.</br></br> If you have any questions, please contact the Connect Coordinating Center via [ConnectCC@nih.gov](mailto:connectcc@nih.gov) or (240) 276-5800.<br/><br/>Sincerely,<br/>the Connect team`,
            "subject": 'Notice: Connect Withdrawal Requested'
        }
    },
    "831041022": {
        "email": {
            "body": `Hello Connect site,<br/><br/>A participant at your site has requested to withdraw from the Connect for Cancer Prevention Study and have their data destroyed.<br/><br/>
            * Participant Connect ID: <Connect_ID><br/><br/>
            Please email [ConnectCC@nih.gov](mailto:connectcc@nih.gov) to confirm that you have received this notification and follow your site-specific Withdrawal SOP for handling this request.</br></br> If you have any questions, please contact the Connect Coordinating Center via [ConnectCC@nih.gov](mailto:connectcc@nih.gov) or (240) 276-5800.<br/><br/>Sincerely,<br/>the Connect team`,
            "subject": 'Notice: Connect Data Destruction Requested'
        }
    },
    "987563196": {
        "email": {
            "body": `Hello Connect site,<br/><br/>A participant at your site has been reported to the Connect Support Center as deceased for the Connect for Cancer Prevention Study.<br/><br/> Please remember that aside from stopping communications and reminders, no additional actions should be taken until the death is corroborated by the Connect Coordinating Center via EMR data or National Death Index (NDI).<br/>
            * Participant Connect ID: <Connect_ID><br/>
            
            Please email [ConnectCC@nih.gov](mailto:connectcc@nih.gov) to confirm that you have received this notification and follow your site-specific Withdrawal SOP for handling this request.</br></br> If you have any questions, please contact the Connect Coordinating Center via [ConnectCC@nih.gov](mailto:connectcc@nih.gov) or (240) 276-5800.<br/><br/>Sincerely,<br/>the Connect team`,
            "subject": 'Notice: Connect Participant Reported as Deceased'
        }
    }
}

const handleSiteNotifications = async (Connect_ID, concept, toEmail, siteId, acronym) => {
    const showdown  = require('showdown');
    const converter = new showdown.Converter();
    const email = templates[concept].email;
    const body = converter.makeHtml(email.body);
    const messageSubject = email.subject
    const html = body.replace('<Connect_ID>', Connect_ID);
    const uuid = require('uuid');
    const { getCoordinatingCenterEmail, storeSiteNotifications } = require('./firestore');
    const cc = await getCoordinatingCenterEmail();
    let reminder = {
        id: uuid(),
        notificationType: 'email',
        email: toEmail,
        cc,
        notification : {
            title: messageSubject,
            body: body,
            time: new Date().toISOString()
        },
        siteAcronym: acronym,
        siteId,
        read: false
    }
    
    const { sendEmail } = require('./notifications');
    await storeSiteNotifications(reminder);
    await sendEmail(toEmail, messageSubject, html, cc);
    return;
}

module.exports = {
    handleSiteNotifications
}