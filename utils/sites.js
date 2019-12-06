const { getResponseJSON, setHeaders } = require('./shared');

const getSiteDetails = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        return res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const { retrieveSiteDetails } = require('./firestore');
    const response = await retrieveSiteDetails();

    if(response instanceof Error){
        return res.status(500).json(getResponseJSON(response.message, 500));
    }

    if(response){
        return res.status(200).json({data: response, code:200})
    }   
}

module.exports = {
    getSiteDetails
}