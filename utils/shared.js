const getResponseJSON = (message, code) => {
    return { message, code };
};

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
}

const generateConnectID = () => {
    return Math.floor(Math.random() * (9999999999 - 1000000000)) + 1000000000;
}

module.exports = {
    getResponseJSON,
    setHeaders,
    generateConnectID
}