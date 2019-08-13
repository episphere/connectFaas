async function loadPage() {
  /* Decide whether to load the index page or the form page (just these 2 for now). If
   * a token is present and it is validated by the backend, show the form, otherwise show
   * just the join button. */
  const token = getToken()
  if (token) {
    const { code, data } = await validateToken(token)
    if (code === 200) {
      window.sessionStorage.token = token
      window.sessionStorage.apiKey = data.access_token
      console.log("-----------------", document.cookie)
      loadForm()
    } else {
      loadButton()
    }
  } else {
    loadButton()
  }
}

async function loadCreds() {
  const { access_token, token } = await getAPIKey()
  window.sessionStorage.apiKey = access_token
  window.sessionStorage.token = token
  window.sessionStorage.currentState = "eligibilityDetermination"
}

function loadButton() {
  /* Hide the eligibility form and show only the button. */
  if (window.sessionStorage.token || window.sessionStorage.apiKey) {
    window.sessionStorage.clear()
  }
  if (window.location.pathname !== pages["index"] && window.location.pathname !== "/") {
    window.location.href = pages["index"]
  }
}

async function loadForm() {
  /* Set the token & APIKey in session storage and redirect to the eligibility form. */
  if (!window.sessionStorage.apiKey || !window.sessionStorage.token) {
    await loadCreds()
  }
  window.location.href = pages["recruit"]
}

window.onload = loadPage