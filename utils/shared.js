const getResponseJSON = (message, code) => {
    return { message, code };
};

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
}

module.exports = {
    getResponseJSON,
    setHeaders
}