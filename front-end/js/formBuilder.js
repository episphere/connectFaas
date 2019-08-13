function createDiv(className, text, required) {
  const inputDiv = document.createElement("div")
  inputDiv.setAttribute("class", className)
  const lineBreak = document.createElement("br")
  inputDiv.appendChild(lineBreak)
  const horizontalRule = document.createElement("hr")
  inputDiv.appendChild(horizontalRule)
  if (text) {
    const questionTextElement = document.createElement("span")
    const questionText = document.createTextNode(text)
    questionTextElement.appendChild(questionText)
    if (required) {
      const asteriskElement = document.createElement("em")
      asteriskElement.setAttribute("class", "requiredFieldStar")
      asteriskElement.setAttribute("style", "color:red; padding-left: 3px;")
      const asteriskText = document.createTextNode("*")
      asteriskElement.appendChild(asteriskText)
      questionTextElement.appendChild(asteriskElement)
    }
    inputDiv.appendChild(questionTextElement)
    inputDiv.appendChild(lineBreak)
  }
  return inputDiv
}

function createTextInput(question) {
  const questionData = question.question
  const textDiv = createDiv(`formdiv_text ${question.source}_${question.sequence}`, questionData.text, question.required)
  const inputField = document.createElement("input")
  inputField.setAttribute("class", `input_text ${question.source}_${question.sequence}`)
  inputField.setAttribute("type", "text")
  inputField.setAttribute("value", "")
  inputField.setAttribute("name", questionData.variableName)
  if (question.required) {
    inputField.required = true
  }
  const lineBreak = document.createElement("br")
  textDiv.appendChild(lineBreak)
  textDiv.appendChild(inputField)
  return textDiv
}

function createRadioInput(question) {
  const questionData = question.question
  const numericIndices = sortedNumericKeys(questionData.answers)
  const radioDiv = createDiv(`formdiv_radio ${question.source}_${question.sequence}`, questionData.text, question.required)
  numericIndices.forEach(answerIndex => {
    const radioInputDiv = document.createElement("div")
    const lineBreak = document.createElement("br")
    radioInputDiv.appendChild(lineBreak)
    radioInputDiv.setAttribute("class", `formdiv_radio_input ${question.source}_${question.sequence}`, "")
    const radioButton = document.createElement("input")
    radioButton.setAttribute("class", `input_radio ${question.source}_${question.sequence}`)
    radioButton.setAttribute("type", "radio")
    radioButton.setAttribute("value", questionData.answers[answerIndex].value)
    radioButton.setAttribute("name", questionData.variableName)
    if (question.required) {
      radioButton.required = true
    }
    radioInputDiv.appendChild(radioButton)
    const radioLabelElement = document.createElement("label")
    radioLabelElement.setAttribute("class", "radio_label")
    const radioLabelText = document.createTextNode(questionData.answers[answerIndex].text)
    radioLabelElement.appendChild(radioLabelText)
    radioInputDiv.appendChild(radioLabelElement)
    radioDiv.appendChild(radioInputDiv)
  })
  return radioDiv
}

function createSelectInput(question) {
  const questionData = question.question
  const selectDiv = createDiv(`formdiv_select ${question.source}_${question.sequence}`, questionData.text, question.required)
  const selectElement = document.createElement("select")
  selectElement.setAttribute("class", `input_select ${question.source}_${question.sequence}`)
  selectElement.setAttribute("name", questionData.variableName)
  selectElement.setAttribute("form", document.forms[0].id)
  if (question.required) {
    selectElement.required = true
  }
  Object.values(questionData.answers).forEach(option => {
    const optionElement = document.createElement("option")
    optionElement.setAttribute("class", "select_option")
    optionElement.setAttribute("value", option.value)
    const optionLabelElement = document.createElement("label")
    optionLabelElement.setAttribute("class", "select_option_label")
    const optionLabelText = document.createTextNode(option.text)
    optionLabelElement.appendChild(optionLabelText)
    optionElement.appendChild(optionLabelElement)
    selectElement.appendChild(optionElement)
  })
  selectDiv.appendChild(selectElement)
  return selectDiv
}

function createMultiSelectInput(question) {
  const questionData = question.question
  const multiSelectDiv = createDiv(`formdiv_multiSelect formdiv_multiSelect ${question.source}_${question.sequence}`, questionData.text, question.required)
  Object.values(questionData.answers).forEach(option => {
    const checkboxDiv = document.createElement("div")
    checkboxDiv.setAttribute("class", `formdiv_checkbox_input ${question.source}_${question.sequence}`, "")
    const lineBreak = document.createElement("br")
    checkboxDiv.appendChild(lineBreak)
    const checkbox = document.createElement("input")
    checkbox.setAttribute("class", `input_checkbox ${question.source}_${question.sequence}`)
    checkbox.setAttribute("type", "checkbox")
    checkbox.setAttribute("value", option.variableName)
    checkbox.setAttribute("name", questionData.variableName)
    if (question.required) {
      checkbox.required = true
    }
    checkboxDiv.appendChild(checkbox)
    const labelElement = document.createElement("label")
    labelElement.setAttribute("class", "multiSelect_checkbox_label")
    const labelText = document.createTextNode(option.text)
    labelElement.appendChild(labelText)
    checkboxDiv.appendChild(labelElement)
    multiSelectDiv.appendChild(checkboxDiv)
  })
  return multiSelectDiv
}

function createSubmitButton(attrs) {
  const submitDiv = document.createElement("div")
  const lineBreak = document.createElement("br")
  submitDiv.appendChild(lineBreak)
  submitDiv.setAttribute("class", "formdiv_submit")
  const submitButton = document.createElement("input")
  submitButton.setAttribute("type", "submit")
  submitButton.setAttribute("class", attrs.class)
  submitButton.setAttribute("onclick", attrs.onclick)
  submitDiv.appendChild(submitButton)
  return submitDiv
}