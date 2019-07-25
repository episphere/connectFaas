exports.validate = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({message: "Only GET requests are accepted", code: 405});
    }
    if(!req.headers.authorization || req.headers.authorization === ""){
       res.status(401).json({message: "Authorization failed!", code: 401});
    }
    else{
        let apiKey = req.headers.authorization.replace('Bearer','').trim();
        const { validateKey } = require(`./utils/firestore`)
        const authorize = await validateKey(apiKey);
        if(authorize instanceof Error){
            res.status(500).json({message: authorize.message, code: 500});
        }
        if(authorize){
            res.status(200).json({message: 'Success!!', code: 200});
        }
        else{
            res.status(401).json({message: "Authorization failed!", code: 401});
        }
    }
};
 
exports.submit = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({message: "Only POST requests are accepted", code: 405});
    }
}