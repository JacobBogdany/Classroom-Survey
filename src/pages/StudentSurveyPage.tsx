import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { surveyService } from '../lib/survey-service'
import { getAnonymousToken, markSurveySubmitted, hasSubmittedSurvey } from '../lib/student-token'
import type { Survey, Question, Choice } from '../types/database'
import { CheckCircle2, AlertCircle, Lock, HelpCircle, Send } from 'lucide-react'

export const StudentSurveyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()

  // Survey Data
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<(Question & { choices: Choice[] })[]>([])

  // Student Answers State: mapping questionId -> selected choiceId
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})

  // UI States
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!slug) return

    let isMounted = true
    const loadSurvey = async () => {
      setLoading(true)
      setErrorMessage(null)

      const result = await surveyService.getActiveSurveyBySlug(slug)
      if (!isMounted) return

      if (result.notFound) {
        setNotFound(true)
      } else if (result.isClosed) {
        setIsClosed(true)
        setSurvey(result.survey)
      } else if (result.error) {
        setErrorMessage(result.error)
      } else if (result.survey && result.questions) {
        setSurvey(result.survey)
        setQuestions(result.questions)

        // Check if student already submitted this survey in this browser
        if (hasSubmittedSurvey(result.survey.id)) {
          setAlreadySubmitted(true)
        }
      }
      setLoading(false)
    }

    loadSurvey()
    return () => {
      isMounted = false
    }
  }, [slug])

  // Select an answer choice for a question
  const handleSelectChoice = (questionId: string, choiceId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }))

    // Clear validation error if previously flagged
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const copy = { ...prev }
        delete copy[questionId]
        return copy
      })
    }
  }

  // Submit responses
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey || submitting) return

    // Validate that all questions have been answered
    const errors: Record<string, string> = {}
    questions.forEach((q) => {
      if (!selectedAnswers[q.id]) {
        errors[q.id] = 'Please select an answer.'
      }
    })

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      // Smooth scroll to first unanswered question
      const firstErrorQId = questions.find((q) => errors[q.id])?.id
      if (firstErrorQId) {
        const el = document.getElementById(`question-card-${firstErrorQId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    const token = getAnonymousToken()
    const answersPayload = questions.map((q) => ({
      question_id: q.id,
      choice_id: selectedAnswers[q.id],
    }))

    const result = await surveyService.submitStudentResponse(survey.id, token, answersPayload)

    setSubmitting(false)

    if (result.success) {
      markSurveySubmitted(survey.id)
      setSubmittedSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      if (result.error?.includes('already submitted')) {
        markSurveySubmitted(survey.id)
        setAlreadySubmitted(true)
      } else {
        setErrorMessage(result.error || 'Failed to submit response. Please try again.')
      }
    }
  }

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Loading survey...</p>
      </div>
    )
  }

  // 2. Survey Not Found State (UI.md Section 8)
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Survey Not Found</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The survey link you followed does not exist or may have been mistyped.
          </p>
        </div>
      </div>
    )
  }

  // 3. Survey Closed State (UI.md Section 8)
  if (isClosed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Survey Closed</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This survey is no longer accepting responses. Thank you for your interest!
          </p>
        </div>
      </div>
    )
  }

  // 4. Already Submitted State (UI.md Section 8)
  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Already Submitted</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You have already submitted a response to this survey.
          </p>
        </div>
      </div>
    )
  }

  // 5. Success State (UI.md Section 8)
  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank you!</h2>
          <p className="text-base text-slate-600 leading-relaxed">
            Your response has been recorded.
          </p>
        </div>
      </div>
    )
  }

  // 6. Active Student Survey Form (UI.md Section 7)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-6 px-4 sm:px-6">
      <main className="max-w-lg w-full mx-auto space-y-6">
        {/* Survey Header (Simple, clean, no menus) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {survey?.title}
          </h1>
          {survey?.description && (
            <p className="mt-2 text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
              {survey.description}
            </p>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Question Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {questions.map((question, qIndex) => {
            const hasError = Boolean(validationErrors[question.id])

            return (
              <div
                key={question.id}
                id={`question-card-${question.id}`}
                className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${
                  hasError ? 'border-red-400 bg-red-50/10 ring-2 ring-red-100' : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
                    {qIndex + 1}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {question.question_text}
                    </h2>
                  </div>
                </div>

                {hasError && (
                  <p className="mb-3 text-xs font-semibold text-red-600">
                    {validationErrors[question.id]}
                  </p>
                )}

                {/* Choices (Large touch targets: minimum 44px, one-column mobile layout) */}
                <div className="space-y-2.5 pt-1">
                  {question.choices.map((choice) => {
                    const isSelected = selectedAnswers[question.id] === choice.id

                    return (
                      <label
                        key={choice.id}
                        className={`flex items-center min-h-[48px] px-4 py-3 rounded-xl border text-sm sm:text-base cursor-pointer select-none transition-all active:scale-[0.99] has-focus-visible:ring-2 has-focus-visible:ring-indigo-600 has-focus-visible:ring-offset-2 ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-600'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        {/* Accessible radio input */}
                        <input
                          type="radio"
                          name={`question_${question.id}`}
                          value={choice.id}
                          checked={isSelected}
                          onChange={() => handleSelectChoice(question.id, choice.id)}
                          className="sr-only"
                        />

                        {/* Custom visual radio circle */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        <span className="flex-1 leading-snug">{choice.choice_text}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Submit Button (Wide, prominent touch target) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-indigo-200 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit'}</span>
            </button>
          </div>
        </form>
      </main>

      {/* Subtle Mobile Footer */}
      <footer className="mt-8 text-center text-xs text-slate-400">
        Classroom Survey • Anonymous student submission
      </footer>
    </div>
  )
}

