const { getResponseJSON, setHeaders } = require('./shared');

const getQuestionnaire = async (req, res) => {
    setHeaders(res);

    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});
    
    if(req.method === 'GET') {
        if(!req.headers.authorization || req.headers.authorization.trim() === ""){
            res.status(401).json(getResponseJSON('Authorization failed!', 401));
        }
        else{
            const apiKey = req.headers.authorization.replace('Bearer','').trim();
            const { validateKey } = require(`./firestore`);
            const authorize = await validateKey(apiKey);
            if(authorize instanceof Error){
                res.status(500).json(getResponseJSON(authorize.message, 500));
            }
            if(authorize){
                const { retrieveQuestionnaire } = require('./firestore');
                if(!req.query.source) {
                    res.status(400).json(getResponseJSON('Please include source as a query parameter!', 400));
                    return;
                }
                const source = req.query.source;
                const response = await retrieveQuestionnaire(source);
                if(response instanceof Error){
                    res.status(500).json(getResponseJSON(response.message, 500));
                }
                if(response){
                    res.status(200).json({data: response, code: 200});
                }
            }
            else{
                res.status(401).json(getResponseJSON('Authorization failed!', 401));
            }
        }
    }
    else {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }
};

module.exports = {
    getQuestionnaire
}