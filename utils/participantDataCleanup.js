const { removeParticipantsDataDestruction, removeUninvitedParticipants } = require(`./firestore`);

const participantDataCleanup = async () => {
    console.log(`Start cleaning up participant data`);
    await Promise.all([removeParticipantsDataDestruction(), removeUninvitedParticipants()])
    console.log(`Complete cleanup of participant data`);
}

module.exports = {
    participantDataCleanup
}