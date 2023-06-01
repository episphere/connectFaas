const participantDataCleanup = async () => {

    console.log(`Start cleaning up participant data`);
    const { removeParticipantsDataDestruction } = require(`./firestore`);
    const { removeUninvitedParticipants } = require(`./firestore`);

    await Promise.all([removeParticipantsDataDestruction(), removeUninvitedParticipants()])
    console.log(`Complete cleanup of participant data`);
}

module.exports = {
    participantDataCleanup
}