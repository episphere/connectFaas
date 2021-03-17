const getResponseJSON = (message, code) => {
    return { message, code };
};

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
}

const setHeadersDomainRestricted = (req, res) => {
    const allowedOrigins = ['http://localhost:5000', 'https://episphere.github.io'];
    // const allowedOrigins = ['https://episphere.github.io'];
    const origin = req.headers.origin;
    if(allowedOrigins.indexOf(origin) !== -1){
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
   }
}

const generateConnectID = () => {
    return Math.floor(Math.random() * (9999999999 - 1000000000)) + 1000000000;
}

const generatePIN = () => {
    return Math.floor(Math.random() * (999999 - 100000)) + 100000;
}

const randomString = () => {
    const length = 6;
    let pin = '';
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    for (let i = length; i > 0; --i) pin += chars[Math.round(Math.random() * (chars.length - 1))];
    return pin;
}

const deleteDocuments = (req, res) => {
    setHeaders(res);
    
    if(req.method === 'OPTIONS') return res.status(200).json({code: 200});

    if(req.method !== 'GET') {
        res.status(405).json(getResponseJSON('Only GET requests are accepted!', 405));
    }

    const siteCode = 809703864;
    const { deleteFirestoreDocuments } = require('./firestore')
    deleteFirestoreDocuments(siteCode)
    res.status(200).json(getResponseJSON('Success!', 200))
}

const lockedAttributes = [
                        "state", 
                        "token", 
                        "pin", 
                        "Connect_ID", 
                        "821247024", 
                        "230663853", 
                        "266600170", 
                        "496823485", 
                        "650465111", 
                        "303552867", 
                        "512820379",
                        "598680838",
                        "454067894",
                        "914639140",
                        "311580100"
                    ] // Read only access after initialization

const filterData = async (queries, siteCodes, isParent) => {
    console.log(queries);
    const { filterDB } = require('./firestore');
    const result = await filterDB(queries, siteCodes, isParent);
    return result;
}

const incentiveFlags = {
    266600170: { // Baseline
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    496823485: { // Follow up 1
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    650465111: { // Follow up 2
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    },
    303552867: { // Follow up 3
		731498909: 104430631,
		648936790: 104430631,
		648228701: 104430631,
		222373868: 104430631
    }
}

const incentiveConcepts = {
    'baseline': 266600170,
    'followup1': 496823485,
    'followup2': 650465111,
    'followup3': 303552867,
    'incentiveIssued': 648936790,
    'incentiveIssuedAt': 297462035,
    'incentiveRefused': 648228701,
    'incentiveRefusedAt': 438636757,
    'caseNumber': 320023644,
    'incentiveChosen': 945795905
}

const SSOConfig = {
    'NIH-SSO-qfszp': {
        group: 'https://federation.nih.gov/person/Groups',
        firstName: 'https://federation.nih.gov/person/FirstName',
        lastName: 'https://federation.nih.gov/person/LastName',
        siteManagerUser: 'CN=connect-study-manager-user',
        biospecimenUser: 'CN=connect-biospecimen-user',
        helpDeskUser: 'CN=connect-help-desk-user'
    }
}

const SSOValidation = async (dashboardType = 'helpDeskUser', idToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjRlMDBlOGZlNWYyYzg4Y2YwYzcwNDRmMzA3ZjdlNzM5Nzg4ZTRmMWUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbmloLW5jaS1kY2VnLWNvbm5lY3QtZGV2IiwiYXVkIjoibmloLW5jaS1kY2VnLWNvbm5lY3QtZGV2IiwiYXV0aF90aW1lIjoxNjE1OTk2ODgwLCJ1c2VyX2lkIjoiOEQzZ0tGaldWY09weW1ZbHRBWFlOQVB4bE5uMSIsInN1YiI6IjhEM2dLRmpXVmNPcHltWWx0QVhZTkFQeGxObjEiLCJpYXQiOjE2MTU5OTY4ODAsImV4cCI6MTYxNjAwMDQ4MCwiZW1haWwiOiJiaGF1bWlrLnBhdGVsMkBuaWguZ292IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsic2FtbC5uaWgtc3NvIjpbImJoYXVtaWsucGF0ZWwyQG5paC5nb3YiXSwiZW1haWwiOlsiYmhhdW1pay5wYXRlbDJAbmloLmdvdiJdfSwic2lnbl9pbl9wcm92aWRlciI6InNhbWwubmloLXNzbyIsInNpZ25faW5fYXR0cmlidXRlcyI6eyJodHRwczovL2ZlZGVyYXRpb24ubmloLmdvdi9wZXJzb24vTGFzdE5hbWUiOiJQYXRlbCIsImh0dHBzOi8vZmVkZXJhdGlvbi5uaWguZ292L3BlcnNvbi9NYWlsIjoiYmhhdW1pay5wYXRlbDJAbmloLmdvdiIsImh0dHBzOi8vZmVkZXJhdGlvbi5uaWguZ292L3BlcnNvbi9Hcm91cHMiOlsiQ049Y29ubmVjdC1oZWxwLWRlc2stdXNlcixPVT1EaXN0cmlidXRpb24gTGlzdHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049Y29ubmVjdC1zdHVkeS1tYW5hZ2VyLXVzZXIsT1U9RGlzdHJpYnV0aW9uIExpc3RzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPWNvbm5lY3QtYmlvc3BlY2ltZW4tdXNlcixPVT1EaXN0cmlidXRpb24gTGlzdHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIENDRTIgVXNlcnMsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPUdyb3VwXzczM2RiNzA4LWYyYzctNDE3Ni05NzBjLTllNTk0ZTdkMWNlOSxPVT1PMzY1IEdyb3VwcyxEQz1uaWgsREM9Z292IiwiQ049TkNJIERDRUcgVERSUCxPVT1EaXN0cmlidXRpb24gTGlzdHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049R3JvdXBfZmJhOTkwMzgtZjNhNC00ZjI0LWI0ZGEtYjE3OGM3ZDgzY2Q3LE9VPU8zNjUgR3JvdXBzLERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgRW50ZXJwcmlzZSBBZGQtSW5zLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1Hcm91cF83ZDkyNWMzNy1lZDNkLTQwZjEtOTRiMS00MzM4ZGI2ZDRmZWEsT1U9TzM2NSBHcm91cHMsREM9bmloLERDPWdvdiIsIkNOPU5DSSBVc2VycyBTb3V0aCxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049bmloX2NpdF9pYW1fU2FpbHBvaW50X0dDUEFjY2VzcyxPVT1HQ1AsT1U9Q2xvdWRHcm91cHMsT1U9T1BTLERDPW5paCxEQz1nb3YiLCJDTj1Hcm91cF9hMTNiNzNlNi1hMWVjLTRlOWQtOTRjZi02MDlhNjMxNzg2NzMsT1U9TzM2NSBHcm91cHMsREM9bmloLERDPWdvdiIsIkNOPUdyb3VwX2FkNDI2MGY1LWU3ZTQtNGUzMS05NDcxLWFlYzAzZDY2MDI0YyxPVT1PMzY1IEdyb3VwcyxEQz1uaWgsREM9Z292IiwiQ049TkNJQUxMU3RhZmZMaXN0LE9VPURpc3RyaWJ1dGlvbiBMaXN0cyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj13aWtpLXVzZXJzLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1Hcm91cF9iNWVmNTdiYS1hOThiLTRjNjUtOTI4OS1mNDk1ZDhkYzhmZjUsT1U9TzM2NSBHcm91cHMsREM9bmloLERDPWdvdiIsIkNOPUdyb3VwXzgyZDdmYTM1LWU5Y2YtNDc0NS04NDZkLWVhYTllNjM4N2NmZCxPVT1PMzY1IEdyb3VwcyxEQz1uaWgsREM9Z292IiwiQ049R3JvdXBfOTNhMmRkODYtNjcwYS00ZjRmLWFhMTItNDAyNzA2YzExYTA4LE9VPU8zNjUgR3JvdXBzLERDPW5paCxEQz1nb3YiLCJDTj1jb2xsYWJvcmF0ZS11c2VycyxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TklIIFNUUklERVMgVHJhaW5pbmcgUGFydGljaXBhbnRzLE9VPURpc3RyaWJ1dGlvbiBMaXN0cyxPVT1DTE9VRCxPVT1PUFMsT1U9Q0lULE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049R3JvdXBfNjg4YTJmYmUtNjc1OC00ODAyLWEzYmYtM2Y4NjQwNzc4MjJlLE9VPU8zNjUgR3JvdXBzLERDPW5paCxEQz1nb3YiLCJDTj1Hcm91cF82Mzk0YTBlMS0zZjhjLTRmZjAtODg2ZS1kM2Y2ZjFiMWJiZDgsT1U9TzM2NSBHcm91cHMsREM9bmloLERDPWdvdiIsIkNOPU5DSSBBTEwgU1RBRkYsT1U9RGlzdHJpYnV0aW9uIExpc3RzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPUdyb3VwX2NiYmVhNzUxLWQ3ZmUtNDI2OS04YjMwLTI2N2M2ZDQ1ZGFlZixPVT1PMzY1IEdyb3VwcyxEQz1uaWgsREM9Z292IiwiQ049TkNJX0JveF9Mb2dpbl9BbGxvd19Hcm91cCxPVT1Hcm91cHMsT1U9Q0lULE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049bmloX25jaV9kY2VnX2ZvbGRlcl92aWV3ZXIsT1U9R0NQLE9VPUNsb3VkR3JvdXBzLE9VPU9QUyxEQz1uaWgsREM9Z292IiwiQ049bmloX25jaV9kY2VnX2VwaXNwaGVyZV9kZXYsT1U9R0NQLE9VPUNsb3VkR3JvdXBzLE9VPU9QUyxEQz1uaWgsREM9Z292IiwiQ049TklIIE8zNjUgU1NQUiBPcGVuIFJlZ2lzdHJhdGlvbixPVT1PMzY1LE9VPUFET0csREM9bmloLERDPWdvdiIsIkNOPU5DSSBBbGwgQ0JJSVQgU3RhZmYgd2l0aG91dCBlbXBsb3llZXMsT1U9R3JvdXBzLE9VPVRlc3RpbmcsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIENCSUlUIElJVE9CIEFsbCBTdGFmZixPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049R3JvdXBfZmMzNzIwNTktYmU1OS00ODYzLTg3ZDQtMTAxNTViMTQzNTExLE9VPU8zNjUgR3JvdXBzLERDPW5paCxEQz1nb3YiLCJDTj1OQ0lfUDQwMV9Ib21lMDMsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPUdDUFVzZXJzLE9VPUdDUCxPVT1DbG91ZEdyb3VwcyxPVT1PUFMsREM9bmloLERDPWdvdiIsIkNOPU5DSSBBbGwgQ0JJSVQgU3RhZmYgVGVzdCBHcm91cCxPVT1Hcm91cHMsT1U9VGVzdGluZyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgVXNlcnMgd2l0aCBtYWlsYm94ZXMsT1U9R3JvdXBzLE9VPUNJVCxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5DSVdlYkV4VGVhbXNUZXN0VXNlcnMsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPUdyb3VwX2ZmYTIwNDM0LTYyYjQtNGQxMy05MjViLWM3MDcxYmRkYjc5NCxPVT1PMzY1IEdyb3VwcyxEQz1uaWgsREM9Z292IiwiQ049TklIIExvZ2luIENsaWVudHMsT1U9RGlzdHJpYnV0aW9uIExpc3RzLE9VPUNJVCxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5DSSBDQklJVCBFbmdpbmVlcmluZyBDYWxlbmRhciBBY2Nlc3MsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5DSU1vYmlsZURldmljZVBvbGljeUJhc2VsaW5lLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OSUggTzM2NSBPRDRCIFVzZXJzLE9VPU8zNjUsT1U9QURPRyxEQz1uaWgsREM9Z292IiwiQ049TkNJIENCSUlUIEFsbCBTdGFmZixPVT1EaXN0cmlidXRpb24gTGlzdHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIEdQLUNvbGxhYm9yYXRlX0dEQ01WX1JXLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgY29uZmx1ZW5jZS11c2VycyxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIEdQLUNGV19OQVRXUF9ERVYsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5DSSBmaXNoZXllLXVzZXJzLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgamlyYS11c2VycyxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIEdQLUNGV19OQ0lXSUtJX1ZJRVdFUlMsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5DSSBVQyBVc2VycyxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIENDRSBVc2VycyxPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIEdQLURydXZhIFVzZXJzLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgQ0JJSVQgU29mdHdhcmUgU29sdXRpb25zLE9VPURpc3RyaWJ1dGlvbiBMaXN0cyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgR3JvdXBWb2wgU0cgR3JvdXAwMixPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIFNoYWR5IEdyb3ZlIEVhc3QgLSBGbG9vciA3LE9VPURpc3RyaWJ1dGlvbiBMaXN0cyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OSUggUFJJTUFSWSBBQ0NPVU5UUyxPVT1OSUggU01BUlRDQVJELE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TkNJIEJ1aWxkaW5nIFNoYWR5IEdyb3ZlLE9VPURpc3RyaWJ1dGlvbiBMaXN0cyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgUFJJTUFSWSBBQ0NPVU5UUyxPVT1OSUggU01BUlRDQVJELE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292IiwiQ049TklIIEdyYW50LVZQTiBOSUgtc3ZwbixPVT1Hcm91cHMsT1U9TklIUkEsT1U9RVMsREM9bmloLERDPWdvdiIsIkNOPU5DSSBQR1AgVXNlcnMsT1U9R3JvdXBzLE9VPU5DSSxPVT1OSUgsT1U9QUQsREM9bmloLERDPWdvdiIsIkNOPU5JSEFjdGl2ZVN5bmNVc2VycyxPVT1BY2NvdW50cyxPVT1DRVMsT1U9T1BTLERDPW5paCxEQz1nb3YiLCJDTj1OQ0kgRG9tYWluIFVzZXJzLE9VPUdyb3VwcyxPVT1OQ0ksT1U9TklILE9VPUFELERDPW5paCxEQz1nb3YiLCJDTj1CRFNTZW5kZXJzLE9VPUFjY291bnRzLE9VPUNFUyxPVT1PUFMsREM9bmloLERDPWdvdiIsIkNOPU5DSSBTdGFmZixPVT1Hcm91cHMsT1U9TkNJLE9VPU5JSCxPVT1BRCxEQz1uaWgsREM9Z292Il0sImh0dHBzOi8vZmVkZXJhdGlvbi5uaWguZ292L3BlcnNvbi9GaXJzdE5hbWUiOiJCaGF1bWlrIn0sInRlbmFudCI6Ik5JSC1TU08tcWZzenAifX0.nJHwaz1NvtC0TJJLV1T9Edt34QYJvo6nge3El32W5XhvJf62KOLkliTa1z4TuHPoKTLIiaWpVkfstUeLXCLrL6wTtpy1hd2sXzPDMI5baxIoQzGX_q05hwVnYCSp0dHzhQZqA2SB5jhGw-UxsIrjgQ5oQ_DDdkZvwa3-hYKCy-pRi4tl1F-i9k2uweut8RRf9AaYsYwmcSuCJwEaEa-rpfMwRwMPz3XoEEhv2EBeKVybbaFAwA1ZpkQCw5mQbnzWj1NOb3mNn0r4R3gJc6Hd37-Kf1eVVslkiOzmT9zQDqi-X56TzSQ3-y4awFBPZapy4TddC6ZQm_lOW8k10wiF2A') => {
    const tenant = decodingJWT(idToken).firebase.tenant;
    const { validateMultiTenantIDToken } = require('./firestore');
    const decodedToken = await validateMultiTenantIDToken(idToken, tenant);
    const allGroups = decodedToken.firebase.sign_in_attributes[SSOConfig[tenant]['group']];
    const requiredGroups = allGroups.filter(dt => new RegExp(SSOConfig[tenant][dashboardType], 'g').test(dt));
    if(requiredGroups.length === 0) return false;
}

const decodingJWT = (token) => {
    if(token !== null || token !== undefined){
        const base64String = token.split('.')[1];
        const decodedValue = JSON.parse(Buffer.from(base64String, 'base64').toString('ascii'));
        return decodedValue;
    }
    return null;
}

// SSOValidation();

const APIAuthorization = async (req, notAuthorized) => {
    if(!req.headers.authorization || req.headers.authorization.trim() === ""){
        return false;
    }
    try {
        let authorized = false;
        const access_token = req.headers.authorization.replace('Bearer ','').trim();
        
        // Remove this after SSO and SA authorization are implemented.
        const { validateSiteUser } = require(`./firestore`);
        authorized = await validateSiteUser(access_token);
        if(!notAuthorized && authorized && authorized.acronym === 'NORC') authorized = false;
        if(notAuthorized && authorized && authorized.acronym !== 'NORC') authorized = false;
        if(authorized instanceof Error){
            return new Error(authorized)
        }
        if(authorized) return authorized;

        const {google} = require("googleapis");
        const OAuth2 = google.auth.OAuth2;
        const oauth2Client = new OAuth2();
        oauth2Client.setCredentials({access_token: access_token});
        const oauth2 = await google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });

        const response = await oauth2.userinfo.get();
        if(response.status === 200) {
            const saEmail = response.data.email;
            console.log('API accessed by ' +saEmail);
            const { validateSiteSAEmail } = require(`./firestore`);
            authorized = await validateSiteSAEmail(saEmail);
            if(!notAuthorized && authorized && authorized.acronym === 'NORC') authorized = false;
            if(notAuthorized && authorized && authorized.acronym !== 'NORC') authorized = false;
            if(authorized instanceof Error){
                return new Error(authorized)
            }
            if(authorized) return authorized;
        }
        return false;
    } catch (error) {
        if(error.code === 401) return false;
        else return new Error(error)
    }
}

const isParentEntity = async (authorized) => {
    const ID = authorized.id;
    const { getChildrens } = require('./firestore');
    let siteCodes = await getChildrens(ID);
    let isParent = siteCodes ? true : false;
    siteCodes = siteCodes ? siteCodes : authorized.siteCode;
    return {isParent, siteCodes};
}

module.exports = {
    getResponseJSON,
    setHeaders,
    generateConnectID,
    generatePIN,
    randomString,
    deleteDocuments,
    setHeadersDomainRestricted,
    filterData,
    incentiveFlags,
    lockedAttributes,
    incentiveConcepts,
    APIAuthorization,
    isParentEntity
}