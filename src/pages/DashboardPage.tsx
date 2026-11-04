import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { BarChart3, LogOut, Plus, User as UserIcon } from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Dashboard Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="flex items-center space-x-2 text-slate-900">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight leading-none">Classroom Survey</span>
                <span className="text-xs text-slate-500 font-medium">Dashboard</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Logged in instructor info */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.email || 'Instructor'}</span>
            </div>

            <Link
              to="/surveys/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Survey</span>
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="sm:hidden mb-4 p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Logged in as:</span>
          <span className="font-semibold text-slate-800">{user?.email}</span>
        </div>

        {/* Phase 4 placeholder / Survey list area */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Welcome to your Dashboard</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            You are securely logged in as <span className="font-medium text-slate-800">{user?.email}</span>.
            In Phase 4, your surveys will appear here with active controls and real-time statuses.
          </p>
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              ● Authentication Connected
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
