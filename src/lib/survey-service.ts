import { supabase } from './supabase'
import type { Survey, Question, Choice, QuestionType, SurveyStatus } from '../types/database'

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
}
