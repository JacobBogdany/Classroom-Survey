import type { EditableQuestion, EditableChoice } from './survey-service'
import type { QuestionType } from '../types/database'

export interface SurveyImportData {
  title: string
  description?: string
  questions: EditableQuestion[]
}

/**
 * Serializes survey structure to formatted JSON for sharing/backup.
 */
export const exportSurveyToJSON = (
  title: string,
  description: string,
  questions: EditableQuestion[]
): string => {
  const exportData = {
    title,
    description: description || undefined,
    questions: questions.map((q, qIdx) => ({
      position: qIdx + 1,
      question_text: q.question_text,
      question_type: q.question_type,
      choices: q.choices.map((c, cIdx) => ({
        position: cIdx + 1,
        choice_text: c.choice_text,
      })),
    })),
  }
  return JSON.stringify(exportData, null, 2)
}

/**
 * Parses and validates an uploaded or pasted JSON survey.
 */
export const parseSurveyFromJSON = (jsonString: string): SurveyImportData => {
  const parsed = JSON.parse(jsonString)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON format.')
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''

  if (!Array.isArray(parsed.questions)) {
    throw new Error('Invalid JSON: missing questions list.')
  }

  const questions: EditableQuestion[] = parsed.questions.map((q: any, qIdx: number) => {
    const qText = typeof q.question_text === 'string' ? q.question_text : ''
    const qType: QuestionType = q.question_type === 'true_false' ? 'true_false' : 'multiple_choice'

    let choices: EditableChoice[] = []
    if (Array.isArray(q.choices)) {
      choices = q.choices.map((c: any, cIdx: number) => {
        const text = typeof c === 'string' ? c : c?.choice_text || ''
        return {
          position: cIdx + 1,
          choice_text: text,
        }
      })
    }

    if (qType === 'true_false' && choices.length === 0) {
      choices = [
        { choice_text: 'True', position: 1 },
        { choice_text: 'False', position: 2 },
      ]
    } else if (choices.length < 2) {
      while (choices.length < 2) {
        choices.push({ choice_text: '', position: choices.length + 1 })
      }
    }

    return {
      position: qIdx + 1,
      question_text: qText,
      question_type: qType,
      choices,
    }
  })

  return { title, description, questions }
}

/**
 * Parses Markdown formatted survey/quiz text into structured questions and choices.
 * Supports:
 * # Survey Title
 * Description...
 * 
 * 1. Question prompt
 * - Choice A
 * - Choice B
 * - Choice C
 */
export const parseSurveyFromMarkdown = (markdown: string): SurveyImportData => {
  const lines = markdown.split(/\r?\n/)
  let title = ''
  let description = ''
  const questions: EditableQuestion[] = []

  let currentQuestion: EditableQuestion | null = null
  let isParsingDescription = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Title: # Title
    if (line.startsWith('# ') && !title) {
      title = line.replace(/^#\s+/, '').trim()
      isParsingDescription = true
      continue
    }

    // Numbered Question: 1. Question Text or Q1. Question Text
    const questionMatch = line.match(/^(\d+[.)]|Q\d+[:.]|###)\s*(.*)/i)
    if (questionMatch) {
      isParsingDescription = false
      if (currentQuestion) {
        finalizeQuestion(currentQuestion)
        questions.push(currentQuestion)
      }

      currentQuestion = {
        position: questions.length + 1,
        question_text: questionMatch[2].trim(),
        question_type: 'multiple_choice',
        choices: [],
      }
      continue
    }

    // Choice item: - Choice or * Choice or a) Choice
    const choiceMatch = line.match(/^([-*•]|[a-d][.)])\s*(.*)/i)
    if (choiceMatch && currentQuestion) {
      const choiceText = choiceMatch[2].trim()
      currentQuestion.choices.push({
        position: currentQuestion.choices.length + 1,
        choice_text: choiceText,
      })
      continue
    }

    // If description line right after title
    if (isParsingDescription && !currentQuestion) {
      description = description ? `${description}\n${line}` : line
    }
  }

  if (currentQuestion) {
    finalizeQuestion(currentQuestion)
    questions.push(currentQuestion)
  }

  return {
    title: title || 'Imported Survey',
    description,
    questions: questions.length > 0 ? questions : [
      {
        position: 1,
        question_text: '',
        question_type: 'multiple_choice',
        choices: [
          { position: 1, choice_text: '' },
          { position: 2, choice_text: '' },
        ],
      },
    ],
  }
}

function finalizeQuestion(q: EditableQuestion) {
  // Check if choices are True and False
  const lowerChoices = q.choices.map((c) => c.choice_text.toLowerCase())
  if (
    lowerChoices.length === 2 &&
    lowerChoices.includes('true') &&
    lowerChoices.includes('false')
  ) {
    q.question_type = 'true_false'
    q.choices = [
      { position: 1, choice_text: 'True' },
      { position: 2, choice_text: 'False' },
    ]
  } else if (q.choices.length < 2) {
    while (q.choices.length < 2) {
      q.choices.push({
        position: q.choices.length + 1,
        choice_text: '',
      })
    }
  }
}
