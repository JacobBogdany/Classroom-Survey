import type { Survey, Question, Choice, StudentResponse, Answer } from '../types/database'

export interface SurveyRawData {
  survey: Survey
  questions: Question[]
  choices: Choice[]
  responses: StudentResponse[]
  answers: Answer[]
}

/**
 * Escapes a single CSV value following RFC 4180:
 * - Null/undefined values become empty strings.
 * - Values containing commas, double quotes, or newlines are wrapped in double quotes.
 * - Existing double quotes inside the string are escaped by doubling them ("").
 */
export const escapeCSV = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generates an RFC 4180 compliant CSV string matching API.md Section 12:
 * Layout:
 * response_id,submitted_at,question_1,question_2,...
 * ... one row per student response ...
 */
export const generateSurveyCSV = (data: SurveyRawData): string => {
  const { survey, questions, choices, responses, answers } = data

  // Choice lookup map: choice_id -> choice_text
  const choiceMap = new Map<string, string>()
  choices.forEach((c) => {
    choiceMap.set(c.id, c.choice_text)
  })

  // Sort questions by position
  const sortedQuestions = [...questions].sort((a, b) => a.position - b.position)

  // Map answers: response_id -> (question_id -> answer text)
  const answerMap = new Map<string, Map<string, string>>()
  answers.forEach((ans) => {
    if (!answerMap.has(ans.response_id)) {
      answerMap.set(ans.response_id, new Map())
    }
    const qMap = answerMap.get(ans.response_id)!
    const answerText = ans.choice_id ? choiceMap.get(ans.choice_id) || '' : ans.text_answer || ''
    qMap.set(ans.question_id, answerText)
  })

  const rows: string[] = []

  // 1. Survey Metadata Header
  rows.push(`# Survey Title: ${escapeCSV(survey.title)}`)
  if (survey.description) {
    rows.push(`# Description: ${escapeCSV(survey.description)}`)
  }
  rows.push(`# Total Responses: ${responses.length}`)
  rows.push(`# Exported At: ${new Date().toISOString()}`)
  rows.push('') // Empty row separator

  // 2. CSV Column Headers (API.md Section 12: response_id, submitted_at, question_1, question_2...)
  const headers: string[] = [
    'Response ID',
    'Submitted At',
    ...sortedQuestions.map((q) => q.question_text),
  ]
  rows.push(headers.map(escapeCSV).join(','))

  // 3. One row per response (API.md Section 12)
  // Sort responses by submitted_at ascending
  const sortedResponses = [...responses].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  )

  sortedResponses.forEach((resp) => {
    const qAnswers = answerMap.get(resp.id)
    const rowValues: string[] = [
      resp.id,
      new Date(resp.submitted_at).toLocaleString(),
      ...sortedQuestions.map((q) => {
        const text = qAnswers?.get(q.id)
        return text !== undefined && text !== '' ? text : '[No answer]'
      }),
    ]
    rows.push(rowValues.map(escapeCSV).join(','))
  })

  return rows.join('\r\n')
}

/**
 * Triggers browser download of the CSV with UTF-8 BOM so Excel & Sheets open cleanly.
 */
export const downloadCSV = (filename: string, csvContent: string): void => {
  // \uFEFF Byte Order Mark for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

