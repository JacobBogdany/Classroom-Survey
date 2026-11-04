import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  surveyService,
  type EditableSurvey,
  type EditableQuestion,
  type EditableChoice,
} from '../lib/survey-service'
import { ConfirmModal } from '../components/ConfirmModal'
import type { QuestionType } from '../types/database'
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  BarChart3,
  ListFilter,
  CheckSquare,
} from 'lucide-react'

export const SurveyEditorPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  // State
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isActiveSurvey, setIsActiveSurvey] = useState(false)
  const [responseCount, setResponseCount] = useState(0)

  // Survey Data Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<EditableQuestion[]>([
    {
      question_text: '',
      question_type: 'multiple_choice',
      position: 1,
      choices: [
        { choice_text: '', position: 1 },
        { choice_text: '', position: 2 },
      ],
    },
  ])

  // Confirmation Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmText?: string
    variant?: 'danger' | 'warning' | 'primary'
    action?: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    message: null,
  })

  // Load existing survey if editing
  useEffect(() => {
    if (!id) return

    let isMounted = true
    const loadSurveyData = async () => {
      setLoading(true)
      const { data, error } = await surveyService.getSurvey(id)
      if (!isMounted) return

      if (error || !data) {
        setError(error || 'Failed to load survey.')
      } else {
        setTitle(data.title)
        setDescription(data.description || '')
        setIsActiveSurvey(data.status === 'active')
        setResponseCount(data.response_count)

        if (data.questions && data.questions.length > 0) {
          const loadedQuestions: EditableQuestion[] = data.questions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            position: q.position,
            choices: q.choices.map((c) => ({
              id: c.id,
              choice_text: c.choice_text,
              position: c.position,
            })),
          }))
          setQuestions(loadedQuestions)
        }
      }
      setLoading(false)
    }

    loadSurveyData()
    return () => {
      isMounted = false
    }
  }, [id])

  // Question Management
  const addQuestion = (type: QuestionType = 'multiple_choice') => {
    const newChoices: EditableChoice[] =
      type === 'true_false'
        ? [
            { choice_text: 'True', position: 1 },
            { choice_text: 'False', position: 2 },
          ]
        : [
            { choice_text: '', position: 1 },
            { choice_text: '', position: 2 },
          ]

    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: type,
        position: prev.length + 1,
        choices: newChoices,
      },
    ])
  }

  const removeQuestion = (qIndex: number) => {
    const question = questions[qIndex]
    if (question.question_text.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Delete Question?',
        message: `Are you sure you want to delete Question ${qIndex + 1}?`,
        confirmText: 'Delete Question',
        variant: 'danger',
        action: async () => {
          setQuestions((prev) => {
            const updated = prev.filter((_, idx) => idx !== qIndex)
            return updated.map((q, idx) => ({ ...q, position: idx + 1 }))
          })
          setModalConfig((m) => ({ ...m, isOpen: false }))
        },
      })
    } else {
      setQuestions((prev) => {
        const updated = prev.filter((_, idx) => idx !== qIndex)
        return updated.map((q, idx) => ({ ...q, position: idx + 1 }))
      })
    }
  }

  const moveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const updated = [...prev]
      const temp = updated[qIndex]
      updated[qIndex] = updated[targetIndex]
      updated[targetIndex] = temp
      return updated.map((q, idx) => ({ ...q, position: idx + 1 }))
    })
  }

  const updateQuestionText = (qIndex: number, text: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      updated[qIndex] = { ...updated[qIndex], question_text: text }
      return updated
    })
    setFieldErrors((prev) => {
      const copy = { ...prev }
      delete copy[`q_${qIndex}_text`]
      return copy
    })
  }

  const updateQuestionType = (qIndex: number, type: QuestionType) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const currentQ = updated[qIndex]
      const choices =
        type === 'true_false'
          ? [
              { choice_text: 'True', position: 1 },
              { choice_text: 'False', position: 2 },
            ]
          : [
              { choice_text: '', position: 1 },
              { choice_text: '', position: 2 },
            ]

      updated[qIndex] = {
        ...currentQ,
        question_type: type,
        choices,
      }
      return updated
    })
  }

  // Choice Management
  const addChoice = (qIndex: number) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const q = updated[qIndex]
      const choices = [
        ...q.choices,
        { choice_text: '', position: q.choices.length + 1 },
      ]
      updated[qIndex] = { ...q, choices }
      return updated
    })
  }

  const updateChoiceText = (qIndex: number, cIndex: number, text: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const q = updated[qIndex]
      const choices = [...q.choices]
      choices[cIndex] = { ...choices[cIndex], choice_text: text }
      updated[qIndex] = { ...q, choices }
      return updated
    })
    setFieldErrors((prev) => {
      const copy = { ...prev }
      delete copy[`q_${qIndex}_c_${cIndex}`]
      return copy
    })
  }

  const removeChoice = (qIndex: number, cIndex: number) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const q = updated[qIndex]
      if (q.choices.length <= 2) return prev // Minimum 2 choices required
      const choices = q.choices
        .filter((_, idx) => idx !== cIndex)
        .map((c, idx) => ({ ...c, position: idx + 1 }))
      updated[qIndex] = { ...q, choices }
      return updated
    })
  }

  const moveChoice = (qIndex: number, cIndex: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const updated = [...prev]
      const q = updated[qIndex]
      const targetIndex = direction === 'up' ? cIndex - 1 : cIndex + 1
      if (targetIndex < 0 || targetIndex >= q.choices.length) return prev
      const choices = [...q.choices]
      const temp = choices[cIndex]
      choices[cIndex] = choices[targetIndex]
      choices[targetIndex] = temp
      updated[qIndex] = {
        ...q,
        choices: choices.map((c, idx) => ({ ...c, position: idx + 1 })),
      }
      return updated
    })
  }

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!title.trim()) {
      errors.title = 'Survey title is required.'
    }

    if (questions.length === 0) {
      errors.general = 'Please add at least one question to the survey.'
    }

    questions.forEach((q, qIdx) => {
      if (!q.question_text.trim()) {
        errors[`q_${qIdx}_text`] = `Question ${qIdx + 1} text cannot be empty.`
      }

      if (q.choices.length < 2) {
        errors[`q_${qIdx}_choices`] = `Question ${qIdx + 1} must have at least 2 choices.`
      }

      q.choices.forEach((c, cIdx) => {
        if (!c.choice_text.trim()) {
          errors[`q_${qIdx}_c_${cIdx}`] = `Choice ${cIdx + 1} cannot be blank.`
        }
      })
    })

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Save
  const handleSave = async (activateImmediately: boolean = false) => {
    if (isActiveSurvey) {
      setError('Active surveys cannot be edited directly. Please close the survey first.')
      return
    }

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    setError(null)

    const payload: EditableSurvey = {
      id,
      title: title.trim(),
      description: description.trim(),
      status: 'draft',
      questions,
    }

    const { id: savedSurveyId, error: saveErr } = await surveyService.saveSurvey(payload)

    if (saveErr || !savedSurveyId) {
      setError(saveErr || 'Failed to save survey.')
      setSaving(false)
      return
    }

    if (activateImmediately) {
      const { error: actErr } = await surveyService.activateSurvey(savedSurveyId)
      if (actErr) {
        setError(`Survey saved as Draft, but activation failed: ${actErr}`)
        setSaving(false)
        return
      }
      navigate(`/surveys/${savedSurveyId}/present`)
    } else {
      navigate('/dashboard')
    }
  }

  // Handle closing active survey to unlock editing
  const handleCloseActiveSurvey = async () => {
    if (!id) return
    setSaving(true)
    const { error } = await surveyService.closeSurvey(id)
    setSaving(false)
    if (error) {
      setError(error)
    } else {
      setIsActiveSurvey(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Loading survey editor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Editor Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-slate-900">
                {isEditing ? 'Edit Survey' : 'New Survey'}
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                Classroom Survey Editor
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving || isActiveSurvey}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={saving || isActiveSurvey}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Activate'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Active Survey Warning Banner */}
        {isActiveSurvey && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Survey is Currently Active</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This survey is currently live for student responses. To edit its questions or
                  choices, you must close it first.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseActiveSurvey}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Close Survey to Edit</span>
            </button>
          </div>
        )}

        {/* Response count warning if editing existing survey with responses */}
        {responseCount > 0 && !isActiveSurvey && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-blue-900 shadow-xs">
            <BarChart3 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <span className="font-semibold text-blue-900">Historical Responses Note: </span>
              This survey already has {responseCount} student response
              {responseCount === 1 ? '' : 's'}. Modifying or removing questions will alter the
              context of existing answers. To create a fresh version for another class session,
              consider duplicating instead.
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {fieldErrors.general && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{fieldErrors.general}</span>
          </div>
        )}

        <fieldset disabled={isActiveSurvey} className="space-y-6">
          {/* Top Section: Title & Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <label
                htmlFor="survey-title"
                className="block text-sm font-semibold text-slate-900 mb-1"
              >
                Survey Title <span className="text-red-500">*</span>
              </label>
              <input
                id="survey-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (fieldErrors.title) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev }
                      delete copy.title
                      return copy
                    })
                  }
                }}
                placeholder="e.g. Recursion Concept Check"
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all ${
                  fieldErrors.title ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="survey-description"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Description <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="survey-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief instructions or context for students..."
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all resize-y"
              />
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {questions.map((question, qIndex) => (
              <div
                key={qIndex}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs relative"
              >
                {/* Question Header & Order Controls */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                      {qIndex + 1}
                    </span>
                    <h3 className="font-semibold text-sm text-slate-900">
                      Question {qIndex + 1}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Reorder Buttons */}
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={() => moveQuestion(qIndex, 'up')}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Question Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={qIndex === questions.length - 1}
                      onClick={() => moveQuestion(qIndex, 'down')}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Question Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-200 mx-1" />

                    {/* Delete Question */}
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text & Type Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div className="md:col-span-2">
                    <label
                      htmlFor={`question-${qIndex}-text`}
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Question Prompt <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={`question-${qIndex}-text`}
                      type="text"
                      value={question.question_text}
                      onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                      placeholder="e.g. What is required for a recursive function?"
                      className={`block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all ${
                        fieldErrors[`q_${qIndex}_text`]
                          ? 'border-red-400 bg-red-50/30'
                          : 'border-slate-300'
                      }`}
                    />
                    {fieldErrors[`q_${qIndex}_text`] && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {fieldErrors[`q_${qIndex}_text`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`question-${qIndex}-type`}
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Question Type
                    </label>
                    <select
                      id={`question-${qIndex}-type`}
                      value={question.question_type}
                      onChange={(e) =>
                        updateQuestionType(qIndex, e.target.value as QuestionType)
                      }
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                    </select>
                  </div>
                </div>

                {/* Choices Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Answer Choices <span className="text-red-500">*</span>
                    </label>
                    {question.question_type === 'multiple_choice' && (
                      <span className="text-xs text-slate-400">At least 2 choices required</span>
                    )}
                  </div>

                  {fieldErrors[`q_${qIndex}_choices`] && (
                    <p className="text-xs text-red-600 font-medium">
                      {fieldErrors[`q_${qIndex}_choices`]}
                    </p>
                  )}

                  <div className="space-y-2">
                    {question.choices.map((choice, cIndex) => {
                      const letter = String.fromCharCode(65 + cIndex) // A, B, C, D...
                      const choiceErrorKey = `q_${qIndex}_c_${cIndex}`

                      return (
                        <div key={cIndex} className="flex items-center gap-2">
                          <span className="w-6 text-center text-xs font-bold text-slate-400">
                            {letter}.
                          </span>

                          <input
                            type="text"
                            value={choice.choice_text}
                            disabled={question.question_type === 'true_false'}
                            onChange={(e) => updateChoiceText(qIndex, cIndex, e.target.value)}
                            placeholder={`Choice ${letter}`}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all ${
                              question.question_type === 'true_false'
                                ? 'bg-slate-50 font-medium text-slate-700'
                                : fieldErrors[choiceErrorKey]
                                ? 'border-red-400 bg-red-50/30'
                                : 'border-slate-300'
                            }`}
                          />

                          {/* Multiple Choice reorder & delete controls */}
                          {question.question_type === 'multiple_choice' && (
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                disabled={cIndex === 0}
                                onClick={() => moveChoice(qIndex, cIndex, 'up')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20"
                                title="Move Choice Up"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={cIndex === question.choices.length - 1}
                                onClick={() => moveChoice(qIndex, cIndex, 'down')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20"
                                title="Move Choice Down"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={question.choices.length <= 2}
                                onClick={() => removeChoice(qIndex, cIndex)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-20 transition-colors"
                                title="Remove Choice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Choice button for Multiple Choice */}
                  {question.question_type === 'multiple_choice' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => addChoice(qIndex)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Choice</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Add Question Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => addQuestion('multiple_choice')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <ListFilter className="w-4 h-4 text-indigo-600" />
                <span>+ Multiple Choice</span>
              </button>

              <button
                type="button"
                onClick={() => addQuestion('true_false')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>+ True / False</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving || isActiveSurvey}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>{saving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || isActiveSurvey}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Activate'}</span>
              </button>
            </div>
          </div>
        </fieldset>
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        variant={modalConfig.variant}
        onConfirm={async () => {
          if (modalConfig.action) {
            await modalConfig.action()
          }
        }}
        onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

