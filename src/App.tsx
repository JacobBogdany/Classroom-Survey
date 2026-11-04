import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

// Lightweight placeholder component for upcoming phases
const PhasePlaceholder: React.FC<{ phaseName: string }> = ({ phaseName }) => {
  const params = useParams()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">{phaseName}</h2>
        <p className="text-sm text-slate-600 mb-4">
          This feature will be fully built in the upcoming phase.
        </p>
        {Object.keys(params).length > 0 && (
          <p className="text-xs font-mono bg-slate-100 p-2 rounded mb-6 text-slate-700">
            Parameters: {JSON.stringify(params)}
          </p>
        )}
        <a
          href="/dashboard"
          className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          ← Return to Dashboard
        </a>
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/s/:slug"
            element={<PhasePlaceholder phaseName="Phase 7: Student Survey Interface" />}
          />

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
                <PhasePlaceholder phaseName="Phase 5: Survey Editor (New Survey)" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/edit"
            element={
              <ProtectedRoute>
                <PhasePlaceholder phaseName="Phase 5: Survey Editor" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/present"
            element={
              <ProtectedRoute>
                <PhasePlaceholder phaseName="Phase 6: Present Survey (Classroom Projector)" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id/results"
            element={
              <ProtectedRoute>
                <PhasePlaceholder phaseName="Phase 9: Survey Results & Analytics" />
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
