import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Placeholders for upcoming phases */}
        <Route
          path="/login"
          element={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-sm w-full text-center">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Instructor Login</h2>
                <p className="text-sm text-slate-600 mb-6">Phase 3 will configure authentication.</p>
                <a
                  href="/"
                  className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  ← Back to Home
                </a>
              </div>
            </div>
          }
        />
        
        {/* Wildcard redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
