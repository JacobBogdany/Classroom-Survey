import { supabase } from './supabase'
import type { Survey, Question, Choice, QuestionType, SurveyStatus, Answer } from '../types/database'

export interface SurveyWithCount extends Survey {
  responses?: { count: number }[]
  response_count?: number
}

export interface EditableChoice {
  id?: string
  choice_text: string
  position: number
}

export interface EditableQuestion {
  id?: string
  question_text: string
  question_type: QuestionType
  position: number
  choices: EditableChoice[]
}

export interface EditableSurvey {
  id?: string
  title: string
  description?: string
  status?: SurveyStatus
  questions: EditableQuestion[]
}

export interface SurveyDetail extends Survey {
  questions: (Question & { choices: Choice[] })[]
  response_count: number
}

export interface ChoiceResult {
  choice_id: string
  choice_text: string
  position: number
  count: number
  percentage: number
}

export interface QuestionResult {
  question_id: string
  question_text: string
  question_type: QuestionType
  position: number
  response_count: number
  unanswered_count: number
  choices: ChoiceResult[]
}

export interface SurveyResultsData {
  survey: Survey
  total_responses: number
  first_response_at?: string | null
  last_response_at?: string | null
  questions: QuestionResult[]
}

export const surveyService = {
  // 1. Fetch surveys with response count
  async listSurveys(): Promise<{ data: SurveyWithCount[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('*, responses(count)')
        .order('created_at', { ascending: false })

      if (error) {
        return { data: null, error: error.message }
      }

      const formatted = (data as SurveyWithCount[]).map((s) => ({
        ...s,
        response_count: s.responses?.[0]?.count ?? 0,
      }))

      return { data: formatted, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load surveys.'
      return { data: null, error: message }
    }
  },

  // 2. Fetch single survey with nested questions and choices
  async getSurvey(surveyId: string): Promise<{ data: SurveyDetail | null; error: string | null }> {
    try {
      const { data: survey, error: sErr } = await supabase
        .from('surveys')
        .select('*, responses(count)')
        .eq('id', surveyId)
        .single()

      if (sErr || !survey) {
        return { data: null, error: sErr?.message || 'Survey not found.' }
      }

      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true })

      if (qErr) {
        return { data: null, error: qErr.message }
      }

      const formattedQuestions = (questions || []).map((q) => ({
        ...q,
        choices: (q.choices || []).sort(
          (a: Choice, b: Choice) => a.position - b.position
        ),
      }))

      return {
        data: {
          ...survey,
          response_count: survey.responses?.[0]?.count ?? 0,
          questions: formattedQuestions,
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch survey details.'
      return { data: null, error: message }
    }
  },

  // 3. Save survey (Insert new or Update existing)
  async saveSurvey(surveyData: EditableSurvey): Promise<{ id: string | null; error: string | null }> {
    try {
      let targetSurveyId = surveyData.id

      // A: Insert or Update the survey row
      if (!targetSurveyId) {
        const { data: createdSurvey, error: createErr } = await supabase
          .from('surveys')
          .insert({
            title: surveyData.title.trim(),
            description: surveyData.description?.trim() || null,
            status: surveyData.status || 'draft',
          })
          .select('id')
          .single()

        if (createErr || !createdSurvey) {
          return { id: null, error: createErr?.message || 'Failed to create survey.' }
        }
        targetSurveyId = createdSurvey.id
      } else {
        const { error: updateErr } = await supabase
          .from('surveys')
          .update({
            title: surveyData.title.trim(),
            description: surveyData.description?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetSurveyId)

        if (updateErr) {
          return { id: null, error: updateErr.message }
        }
      }

      // B: Handle questions and choices
      // Fetch existing question IDs in DB for this survey
      const { data: existingQuestions } = await supabase
        .from('questions')
        .select('id')
        .eq('survey_id', targetSurveyId)

      const existingQIds = new Set((existingQuestions || []).map((q) => q.id))
      const currentQIds = new Set(
        surveyData.questions.filter((q) => !!q.id).map((q) => q.id as string)
      )

      // Delete questions that were removed in the UI
      for (const oldQId of existingQIds) {
        if (!currentQIds.has(oldQId)) {
          await supabase.from('questions').delete().eq('id', oldQId)
        }
      }

      // Insert or update each question
      for (let qIndex = 0; qIndex < surveyData.questions.length; qIndex++) {
        const qData = surveyData.questions[qIndex]
        let currentQuestionId = qData.id

        if (!currentQuestionId) {
          const { data: newQ, error: newQErr } = await supabase
            .from('questions')
            .insert({
              survey_id: targetSurveyId,
              question_text: qData.question_text.trim(),
              question_type: qData.question_type,
              position: qIndex + 1,
            })
            .select('id')
            .single()

          if (newQErr || !newQ) {
            console.error('Error inserting question:', newQErr)
            continue
          }
          currentQuestionId = newQ.id
        } else {
          await supabase
            .from('questions')
            .update({
              question_text: qData.question_text.trim(),
              question_type: qData.question_type,
              position: qIndex + 1,
            })
            .eq('id', currentQuestionId)
        }

        // Handle choices for this question
        const { data: existingChoices } = await supabase
          .from('choices')
          .select('id')
          .eq('question_id', currentQuestionId)

        const existingChoiceIds = new Set((existingChoices || []).map((c) => c.id))
        const currentChoiceIds = new Set(
          qData.choices.filter((c) => !!c.id).map((c) => c.id as string)
        )

        // Delete choices removed in UI
        for (const oldCId of existingChoiceIds) {
          if (!currentChoiceIds.has(oldCId)) {
            await supabase.from('choices').delete().eq('id', oldCId)
          }
        }

        // Insert or update choices
        for (let cIndex = 0; cIndex < qData.choices.length; cIndex++) {
          const cData = qData.choices[cIndex]
          if (!cData.id) {
            await supabase.from('choices').insert({
              question_id: currentQuestionId,
              choice_text: cData.choice_text.trim(),
              position: cIndex + 1,
            })
          } else {
            await supabase
              .from('choices')
              .update({
                choice_text: cData.choice_text.trim(),
                position: cIndex + 1,
              })
              .eq('id', cData.id)
          }
        }
      }

      return { id: targetSurveyId ?? null, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save survey.'
      return { id: null, error: message }
    }
  },

  // 4. Activate survey (calls RPC)
  async activateSurvey(surveyId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('activate_survey', {
        p_survey_id: surveyId,
      })
      if (error) {
        return { error: error.message }
      }
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to activate survey.'
      return { error: message }
    }
  },

  // 5. Close survey (calls RPC)
  async closeSurvey(surveyId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('close_survey', {
        p_survey_id: surveyId,
      })
      if (error) {
        return { error: error.message }
      }
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close survey.'
      return { error: message }
    }
  },

  // 6. Archive survey
  async archiveSurvey(surveyId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', surveyId)

      if (error) {
        return { error: error.message }
      }
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to archive survey.'
      return { error: message }
    }
  },

  // 7. Delete survey (cascades to questions, choices, responses, answers)
  async deleteSurvey(surveyId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.from('surveys').delete().eq('id', surveyId)
      if (error) {
        return { error: error.message }
      }
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete survey.'
      return { error: message }
    }
  },

  // 8. Duplicate survey
  async duplicateSurvey(surveyId: string): Promise<{ newId: string | null; error: string | null }> {
    try {
      const { data: original, error: origErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single()

      if (origErr || !original) {
        return { newId: null, error: origErr?.message || 'Survey not found.' }
      }

      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true })

      if (qErr) {
        return { newId: null, error: qErr.message }
      }

      const newTitle = original.title.startsWith('Copy of ')
        ? original.title
        : `Copy of ${original.title}`

      const { data: newSurvey, error: createErr } = await supabase
        .from('surveys')
        .insert({
          title: newTitle,
          description: original.description,
          status: 'draft',
        })
        .select()
        .single()

      if (createErr || !newSurvey) {
        return { newId: null, error: createErr?.message || 'Failed to create duplicate survey.' }
      }

      if (questions && questions.length > 0) {
        for (const q of questions) {
          const { data: newQuestion, error: newQErr } = await supabase
            .from('questions')
            .insert({
              survey_id: newSurvey.id,
              question_text: q.question_text,
              question_type: q.question_type,
              position: q.position,
            })
            .select()
            .single()

          if (newQErr || !newQuestion) {
            console.error('Error duplicating question:', newQErr)
            continue
          }

          if (q.choices && q.choices.length > 0) {
            const choicesToInsert = q.choices.map(
              (c: { choice_text: string; position: number }) => ({
                question_id: newQuestion.id,
                choice_text: c.choice_text,
                position: c.position,
              })
            )

            await supabase.from('choices').insert(choicesToInsert)
          }
        }
      }

      return { newId: newSurvey.id, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate survey.'
      return { newId: null, error: message }
    }
  },

  // 9. Fetch active survey for students by slug (or UUID)
  async getActiveSurveyBySlug(slug: string): Promise<{
    survey: Survey | null
    questions: (Question & { choices: Choice[] })[] | null
    notFound?: boolean
    isClosed?: boolean
    error: string | null
  }> {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

      let query = supabase.from('surveys').select('*')
      if (isUUID) {
        query = query.or(`public_slug.eq.${slug},id.eq.${slug}`)
      } else {
        query = query.eq('public_slug', slug)
      }

      const { data: survey, error: sErr } = await query.maybeSingle()

      if (sErr) {
        return { survey: null, questions: null, error: sErr.message }
      }

      if (!survey) {
        return { survey: null, questions: null, notFound: true, error: null }
      }

      if (survey.status !== 'active') {
        return { survey, questions: null, isClosed: true, error: null }
      }

      // Fetch questions and choices
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .eq('survey_id', survey.id)
        .order('position', { ascending: true })

      if (qErr) {
        return { survey, questions: null, error: qErr.message }
      }

      const sortedQuestions = (questions || []).map((q) => ({
        ...q,
        choices: (q.choices || []).sort((a: Choice, b: Choice) => a.position - b.position),
      }))

      return { survey, questions: sortedQuestions, error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load survey.'
      return { survey: null, questions: null, error: message }
    }
  },

  // 10. Submit student survey answers
  async submitStudentResponse(
    surveyId: string,
    anonymousToken: string,
    answers: { question_id: string; choice_id?: string | null; text_answer?: string | null }[]
  ): Promise<{ success: boolean; responseId?: string; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('submit_survey_response', {
        p_survey_id: surveyId,
        p_anonymous_token: anonymousToken,
        p_answers: answers,
      })

      if (error) {
        // Map database exception to friendly user message (API.md Section 10)
        let friendlyMessage = error.message
        if (error.message.includes('SURVEY_NOT_ACTIVE')) {
          friendlyMessage = 'This survey is no longer accepting responses.'
        } else if (error.message.includes('DUPLICATE_RESPONSE')) {
          friendlyMessage = 'You have already submitted a response to this survey.'
        } else if (error.message.includes('INVALID_QUESTION')) {
          friendlyMessage = 'Invalid question specified in submission.'
        } else if (error.message.includes('INVALID_CHOICE')) {
          friendlyMessage = 'Invalid choice selected.'
        }
        return { success: false, error: friendlyMessage }
      }

      return {
        success: true,
        responseId: data?.response_id,
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed.'
      return { success: false, error: message }
    }
  },

  // 11. Fetch aggregated survey results
  async getSurveyResults(surveyId: string): Promise<{ data: SurveyResultsData | null; error: string | null }> {
    try {
      // 1. Fetch survey
      const { data: survey, error: sErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single()

      if (sErr || !survey) {
        return { data: null, error: sErr?.message || 'Survey not found.' }
      }

      // 2. Fetch questions and choices
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true })

      if (qErr) {
        return { data: null, error: qErr.message }
      }

      // 3. Fetch all responses for this survey
      const { data: responses, error: rErr } = await supabase
        .from('responses')
        .select('id, submitted_at')
        .eq('survey_id', surveyId)

      if (rErr) {
        return { data: null, error: rErr.message }
      }

      const totalResponses = responses?.length ?? 0
      const responseIds = (responses || []).map((r) => r.id)
      const sortedTimestamps = (responses || [])
        .map((r) => r.submitted_at)
        .filter(Boolean)
        .sort()
      const firstResponseAt = sortedTimestamps[0] || null
      const lastResponseAt = sortedTimestamps[sortedTimestamps.length - 1] || null

      // 4. Fetch all answers for these responses
      let answers: Answer[] = []
      if (responseIds.length > 0) {
        const { data: answersData, error: aErr } = await supabase
          .from('answers')
          .select('*')
          .in('response_id', responseIds)

        if (aErr) {
          return { data: null, error: aErr.message }
        }
        answers = answersData || []
      }

      // 5. Aggregate answers by question and choice
      const aggregatedQuestions: QuestionResult[] = (questions || []).map((q) => {
        const qAnswers = answers.filter((a) => a.question_id === q.id)
        const qAnswerCount = qAnswers.length
        const unansweredCount = Math.max(0, totalResponses - qAnswerCount)

        const sortedChoices = (q.choices || []).sort(
          (a: Choice, b: Choice) => a.position - b.position
        )

        const choicesResults: ChoiceResult[] = sortedChoices.map((c: Choice) => {
          const choiceCount = qAnswers.filter((a) => a.choice_id === c.id).length
          const percentage =
            totalResponses > 0
              ? Math.round((choiceCount / totalResponses) * 1000) / 10
              : 0

          return {
            choice_id: c.id,
            choice_text: c.choice_text,
            position: c.position,
            count: choiceCount,
            percentage,
          }
        })

        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          position: q.position,
          response_count: qAnswerCount,
          unanswered_count: unansweredCount,
          choices: choicesResults,
        }
      })

      return {
        data: {
          survey,
          total_responses: totalResponses,
          first_response_at: firstResponseAt,
          last_response_at: lastResponseAt,
          questions: aggregatedQuestions,
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to compute survey results.'
      return { data: null, error: message }
    }
  },

  // 12. Fetch raw survey data for CSV Export (API.md Section 12)
  async fetchSurveyRawData(surveyId: string) {
    try {
      const { data: survey, error: sErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single()

      if (sErr || !survey) {
        return { data: null, error: sErr?.message || 'Survey not found.' }
      }

      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true })

      if (qErr) {
        return { data: null, error: qErr.message }
      }

      const qIds = (questions || []).map((q) => q.id)
      let choices: Choice[] = []
      if (qIds.length > 0) {
        const { data: choicesData, error: cErr } = await supabase
          .from('choices')
          .select('*')
          .in('question_id', qIds)
          .order('position', { ascending: true })

        if (cErr) {
          return { data: null, error: cErr.message }
        }
        choices = choicesData || []
      }

      const { data: responses, error: rErr } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: true })

      if (rErr) {
        return { data: null, error: rErr.message }
      }

      const rIds = (responses || []).map((r) => r.id)
      let answers: Answer[] = []
      if (rIds.length > 0) {
        const { data: answersData, error: aErr } = await supabase
          .from('answers')
          .select('*')
          .in('response_id', rIds)

        if (aErr) {
          return { data: null, error: aErr.message }
        }
        answers = answersData || []
      }

      return {
        data: {
          survey,
          questions: questions || [],
          choices,
          responses: responses || [],
          answers,
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch raw survey data.'
      return { data: null, error: message }
    }
  },
}
