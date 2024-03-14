const {
    removeParticipantsDataDestruction,
    removeUninvitedParticipants,
} = require(`./firestore`);

const participantDataCleanup = async (_, res) => {
    try {
        console.log(`Start cleaning up participant data`);
        await Promise.all([removeParticipantsDataDestruction(), removeUninvitedParticipants()]);
        console.log(`Complete cleanup of participant data`);
        return res.status(200).json({ code: 200 });
    } catch (e) {
        console.error("Error participantDataCleanup", e);
        return res.status(500).json({ code: 500 });
    }
};

module.exports = {
    participantDataCleanup,
};
