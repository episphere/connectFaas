const backendHost = `https://us-central1-nih-nci-dceg-episphere-dev.cloudfunctions.net`
const questionnaireHost = window.location.host
const endpoints = {
  "getKey": `getKey`,
  "validateToken": `validateToken`,
  "getQuestions": `assets`,
  "submitScreener": `recruit/submit`
}
const questionnaires = {
  "eligibilityDetermination": "eligibility_screener",
  "ineligibilityRequestDetails": "ineligibility_questionnaire",
}
const pages = {
  "index": `/index.html`,
  "recruit": `/recruit.html`
}

function getToken() {
  /* Retrieves the token from the URL. Returns null if not present. */
  const queryParams = new URLSearchParams(window.location.search)
  const token = queryParams.get('token')
  return token
}

function getAPIKey() {
  /* Function to obtain a temporary API-Key from the backend for cases where the
   * token is either not provided or is absent. */
  const requestURL = `${backendHost}/${endpoints["getKey"]}`
  const request = fetch(requestURL).then((response) => {
    return response.json()
  }).catch((err) => {
    console.log(err)
  })
  return request
}

function validateToken(token) {
  /* Calls the validateToken API to know if the retrieved token is a valid token.
   * Expects to receive an API-Key from the backend to make subsequent calls. */
  const requestURL = `${backendHost}/${endpoints["validateToken"]}?token=${token}`
  const request = fetch(requestURL).then((response) => {
    return response.json()
  }).catch((err) => {
    console.log(err)
  })
  return request
}

function getQuestions(source) {
  const requestURL = `${questionnaireHost}/${endpoints["getQuestions"]}/${source}.json`
  const request = fetch(requestURL).then((response) => {
    return response.json()
  }).catch((err) => {
    console.log(err)
  })
  return request
}

function sortedNumericKeys(obj) {
  return Object.keys(obj).map(key => parseInt(key)).sort()
}