import { supabase } from './supabase'
import type { Survey } from '../types/database'

export interface SurveyWithCount extends Survey {
  responses?: { count: number }[]
  response_count?: number
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

  // 2. Activate survey (calls RPC)
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

  // 3. Close survey (calls RPC)
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

  // 4. Archive survey
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

  // 5. Delete survey (cascades to questions, choices, responses, answers)
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

  // 6. Duplicate survey (copies survey, questions, choices; drops responses; sets status=draft)
  async duplicateSurvey(surveyId: string): Promise<{ newId: string | null; error: string | null }> {
    try {
      // Step A: Load original survey
      const { data: original, error: origErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single()

      if (origErr || !original) {
        return { newId: null, error: origErr?.message || 'Survey not found.' }
      }

      // Step B: Load questions and choices
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true })

      if (qErr) {
        return { newId: null, error: qErr.message }
      }

      // Step C: Create copy in Draft state
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

      // Step D: Copy questions and choices
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

          // Duplicate choices for this question
          if (q.choices && q.choices.length > 0) {
            const choicesToInsert = q.choices.map((c: { choice_text: string; position: number }) => ({
              question_id: newQuestion.id,
              choice_text: c.choice_text,
              position: c.position,
            }))

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

