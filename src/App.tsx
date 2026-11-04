import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SurveyEditorPage } from './pages/SurveyEditorPage'
import { PresentPage } from './pages/PresentPage'
import { StudentSurveyPage } from './pages/StudentSurveyPage'
import { ResultsPage } from './pages/ResultsPage'

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/s/:slug" element={<StudentSurveyPage />} />

          {/* Protected instructor routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/new"
            element={
              <ProtectedRoute>
                <SurveyEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/edit"
            element={
              <ProtectedRoute>
                <SurveyEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/present"
            element={
              <ProtectedRoute>
                <PresentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/results"
            element={
              <ProtectedRoute>
                <ResultsPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
