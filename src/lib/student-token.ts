const TOKEN_KEY = 'classroom_survey_anon_token'

export const getAnonymousToken = (): string => {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token = 'anon_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36))
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    // Fallback if localStorage is disabled
    return 'anon_session_' + Math.random().toString(36).substring(2)
  }
}

export const markSurveySubmitted = (surveyId: string): void => {
  try {
    localStorage.setItem(`survey_submitted_${surveyId}`, 'true')
  } catch (err) {
    console.error('Error saving submission status to localStorage:', err)
  }
}

export const hasSubmittedSurvey = (surveyId: string): boolean => {
  try {
    return localStorage.getItem(`survey_submitted_${surveyId}`) === 'true'
  } catch {
    return false
  }
}

