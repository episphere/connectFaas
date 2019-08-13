if (!window.sessionStorage.token || !window.sessionStorage.apiKey) {
  window.location.href = '/index.html'
}

function createInputElement(question) {
  const {
    answerType
  } = question.question
  let inputElement = {}

  switch (answerType) {
    case `text`:
      inputElement = createTextInput(question)
      break

    case `radio`:
      inputElement = createRadioInput(question)
      break

    case `select`:
      inputElement = createSelectInput(question)
      break

    case `multi-select`:
      inputElement = createMultiSelectInput(question)
      break

    default:
  }
  return inputElement
}

async function submitEligibilityForm(source) {
  const eligibilityForm = document.getElementById("eligibilityForm")
  // Convert the HTML Collection containing all child, grandchild... nodes of the form to an array, then filter only those whose classes have "input" in them.
  const childNodes = Array.from(eligibilityForm.getElementsByTagName("*"))
  const inputElements = childNodes.filter(element => element.className.includes("input_"))

  const formInput = {}
  inputElements.forEach(element => {
    switch (element.type) {
      case 'text':
        formInput[element.name] = element.value
        break

      case 'radio':
        if (element.checked) {
          formInput[element.name] = parseInt(element.value) === NaN ? element.value : parseInt(element.value)
        }
        break

      case 'select-one':
        formInput[element.name] = parseInt(element.value) === NaN ? element.value : parseInt(element.value)
        break

      case 'checkbox':
        if (!formInput[element.name]) {
          formInput[element.name] = {}
        }
        const isSelected = element.checked ? 1 : 0
        formInput[element.name][element.value] = isSelected
        break

      default:
    }
  })
  formInput["source"] = source
  formInput["token"] = window.sessionStorage.token
  const response = await submitForm(formInput)
  
}

async function submitForm(formInput) {
  const requestURL = `${backendHost}/${endpoints["submitScreener"]}`
  const request = fetch(requestURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      "Authorization": `Bearer ${window.sessionStorage.apiKey}`
    },
    body: JSON.stringify(formInput)
  }).then(response => {
    return response.json()
  }).catch((err) => {
    console.log(err)
  })
  return request
}

async function populateForm(source) {
  window.location.hash = `#token=${window.sessionStorage.token}`

  if (!source) {
    const source = questionnaires["eligibilityDetermination"]
  }

  let questions = []
  try {
    const data = await getQuestions(source)
    if (data.code !== 200) {
      throw new Error(data.code)
    }
    questions = data.data
  } catch (err) {
    if (parseInt(err.message) === 401) {
      const {
        access_token
      } = await validateToken(window.sessionStorage.token)
      window.sessionStorage.apiKey = access_token
      window.location.reload()
    } else {
      console.log(err)
      document.write("CAN'T LOAD PAGE RIGHT NOW. PLEASE TRY AGAIN LATER!!!")
    }
  }

  const formElement = document.getElementById("eligibilityForm")
  questions.forEach(question => {
    const inputElement = createInputElement(question)
    formElement.appendChild(inputElement)
  })
  const submitButtonAttrs = {
    "class": `button_submit ${source}_${questions.length}`,
    "onclick": ``
  }
  const submitDiv = createSubmitButton(submitButtonAttrs)
  formElement.appendChild(submitDiv)

}

window.onload = () => populateForm(questionnaires["eligibilityDetermination"])