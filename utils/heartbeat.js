const { logIPAddress, setHeaders } = require('./shared');
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

const heartbeat = async (req, res) => {
    logIPAddress(req);
    setHeaders(res);

    if(req.method === 'OPTIONS') {
        return res.status(200).json({code: 200});
    }

    if(req.method !== 'GET') {
        return res.status(405).json({ code: 405, data: 'Only GET requests are accepted!'});
    }

    const currentTime = new Date();

    const hours = currentTime.getUTCHours().toString().padStart(2, '0');
    const minutes = currentTime.getUTCMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getUTCSeconds().toString().padStart(2, '0');

    const query = `SELECT * FROM \`nih-nci-dceg-connect-dev.heartbeat.recruitment_summary\``;
    const rows = await bigquery.query(query);

    const payload = {
        utc: `${hours}:${minutes}:${seconds}`,
        activeParticipants: rows.num_active_participants,
        maleParticipants: rows.num_male_participants,
        femaleParticipants: rows.num_female_participants
    }

    return res.status(200).json({ code: 200, data: payload});
}

module.exports = {
    heartbeat
}