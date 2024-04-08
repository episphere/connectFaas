const {
    removeParticipantsDataDestruction,
    removeUninvitedParticipants,
} = require(`./firestore`);

const participantDataCleanup = async () => {
    try {
        console.log(`Start cleaning up participant data`);
        await Promise.all([removeParticipantsDataDestruction(), removeUninvitedParticipants()]);
        console.log(`Complete cleanup of participant data`);
    } catch (e) {
        console.error("Error participantDataCleanup", e);
    }
};

module.exports = {
    participantDataCleanup,
};
