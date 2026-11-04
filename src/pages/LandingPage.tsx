import React from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, LogIn, QrCode, Sparkles, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../context/useAuth'

const currentYear = new Date().getFullYear()

export const LandingPage: React.FC = () => {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="w-full border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg text-slate-900 tracking-tight">
              Classroom Survey
            </span>
          </div>
          <div>
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors py-2 px-3 rounded-md hover:bg-indigo-50"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors py-2 px-3 rounded-md hover:bg-slate-100"
              >
                <LogIn className="w-4 h-4" />
                <span>Instructor Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Fast, frictionless classroom assessment</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Classroom Survey
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-slate-600 font-normal leading-relaxed">
            Quick in-class understanding checks.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-sm shadow-indigo-200"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-sm shadow-indigo-200"
              >
                <LogIn className="w-4 h-4" />
                <span>Instructor Login</span>
              </Link>
            )}
          </div>

          {/* Quick value props */}
          <div className="mt-14 pt-10 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs">
              <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 mb-2.5">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900">Zero-Friction QR Scan</h3>
              <p className="text-xs text-slate-500 mt-1">
                Students scan the projected QR code and vote immediately. No login or app installation required.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs">
              <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 mb-2.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900">Instant Comprehension</h3>
              <p className="text-xs text-slate-500 mt-1">
                Collect and visualize responses in real-time to adjust lectures and clarify misconceptions on the fly.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {currentYear} Classroom Survey App. Open source & lightweight.</p>
          <p>Optimized for classroom projectors and mobile browsers.</p>
        </div>
      </footer>
    </div>
  )
}
