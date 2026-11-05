import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { BarChart3, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [user, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    setSubmitting(true)
    const res = await signIn(email.trim(), password)
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }

  // One-click demo login for evaluators / testing
  const handleDemoLogin = async () => {
    setError(null)
    const demoEmail = import.meta.env.VITE_DEMO_EMAIL
    const demoPassword = import.meta.env.VITE_DEMO_PASSWORD

    if (!demoEmail || !demoPassword) {
      setError('Demo credentials are not configured in VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD environment variables.')
      return
    }

    setDemoLoading(true)
    const res = await signIn(demoEmail.trim(), demoPassword)
    setDemoLoading(false)

    if (res.error) {
      setError(`Demo login failed: ${res.error}`)
    } else {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <Link
            to="/"
            className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm hover:bg-indigo-700 transition-colors"
            title="Classroom Survey Home"
            aria-label="Classroom Survey Home"
          >
            <BarChart3 className="w-6 h-6" />
          </Link>
        </div>
        <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900">
          Instructor Login
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Sign in to manage and present your surveys
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="instructor@example.edu"
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || demoLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Signing in...' : 'Log In'}
            </button>
          </form>

          {/* Quick Demo Login Option */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-slate-500 font-medium tracking-wider">
                  Or test with demo access
                </span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting || demoLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-indigo-200 rounded-lg shadow-2xs text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 active:bg-indigo-200/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{demoLoading ? 'Logging in as Demo Instructor...' : 'Log In as Demo Instructor'}</span>
              </button>
              <p className="mt-1.5 text-center text-2xs text-slate-400">
                Instantly explore the instructor dashboard without typing credentials.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link
              to="/"
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
