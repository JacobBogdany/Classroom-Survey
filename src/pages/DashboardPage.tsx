import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { surveyService, type SurveyWithCount } from '../lib/survey-service'
import { ConfirmModal } from '../components/ConfirmModal'
import type { SurveyStatus } from '../types/database'
import {
  BarChart3,
  LogOut,
  Plus,
  Search,
  Filter,
  QrCode,
  Edit,
  Copy,
  Archive,
  Trash2,
  CheckCircle2,
  Lock,
  User as UserIcon,
  RefreshCw,
  AlertCircle,
  Calendar,
  ArrowUpDown,
} from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [surveys, setSurveys] = useState<SurveyWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SurveyStatus>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  // Modals state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmText?: string
    variant?: 'danger' | 'warning' | 'primary'
    action?: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    message: null,
  })

  // Load surveys
  const fetchSurveys = useCallback(async () => {
    setError(null)
    const { data, error } = await surveyService.listSurveys()
    if (error) {
      setError(error)
    } else {
      setSurveys(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let ignore = false
    void (async () => {
      const { data, error } = await surveyService.listSurveys()
      if (!ignore) {
        if (error) {
          setError(error)
        } else {
          setSurveys(data || [])
        }
        setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Filtered & Sorted surveys (Phase 10: Historical Results & Date filtering)
  const filteredSurveys = useMemo(() => {
    return surveys
      .filter((survey) => {
        const matchesSearch =
          survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (survey.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)

        const matchesStatus = statusFilter === 'all' || survey.status === statusFilter

        const matchesDate = (() => {
          if (dateFilter === 'all') return true
          const created = new Date(survey.created_at).getTime()
          const now = Date.now()
          if (dateFilter === 'today') {
            const todayStart = new Date().setHours(0, 0, 0, 0)
            return created >= todayStart
          }
          if (dateFilter === 'week') {
            const weekAgo = now - 7 * 24 * 60 * 60 * 1000
            return created >= weekAgo
          }
          if (dateFilter === 'month') {
            const monthAgo = now - 30 * 24 * 60 * 60 * 1000
            return created >= monthAgo
          }
          return true
        })()

        return matchesSearch && matchesStatus && matchesDate
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime()
        const timeB = new Date(b.created_at).getTime()
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
      })
  }, [surveys, searchQuery, statusFilter, dateFilter, sortOrder])

  // Status Badge Helper
  const renderStatusBadge = (status: SurveyStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        )
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        )
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
            Closed
          </span>
        )
      case 'archived':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Archived
          </span>
        )
    }
  }

  // Action handlers with confirmations
  const triggerActivate = (survey: SurveyWithCount) => {
    setModalConfig({
      isOpen: true,
      title: `Activate "${survey.title}"?`,
      message: (
        <span>
          Activating this survey will automatically close any currently active survey.
          Students scanning your QR code will immediately be directed to this survey.
        </span>
      ),
      confirmText: 'Activate Survey',
      variant: 'primary',
      action: async () => {
        setActionLoading(true)
        const { error } = await surveyService.activateSurvey(survey.id)
        setActionLoading(false)
        if (error) {
          alert(`Error activating survey: ${error}`)
        } else {
          setModalConfig((prev) => ({ ...prev, isOpen: false }))
          await fetchSurveys()
        }
      },
    })
  }

  const triggerClose = (survey: SurveyWithCount) => {
    setModalConfig({
      isOpen: true,
      title: `Close "${survey.title}"?`,
      message: (
        <span>
          Closing this survey will stop accepting responses immediately. Students will no
          longer be able to submit answers.
        </span>
      ),
      confirmText: 'Close Survey',
      variant: 'warning',
      action: async () => {
        setActionLoading(true)
        const { error } = await surveyService.closeSurvey(survey.id)
        setActionLoading(false)
        if (error) {
          alert(`Error closing survey: ${error}`)
        } else {
          setModalConfig((prev) => ({ ...prev, isOpen: false }))
          await fetchSurveys()
        }
      },
    })
  }

  const triggerArchive = (survey: SurveyWithCount) => {
    setModalConfig({
      isOpen: true,
      title: `Archive "${survey.title}"?`,
      message: (
        <span>
          Archived surveys are preserved in your records and their results can still be
          viewed, but they will be hidden from the default active view.
        </span>
      ),
      confirmText: 'Archive',
      variant: 'warning',
      action: async () => {
        setActionLoading(true)
        const { error } = await surveyService.archiveSurvey(survey.id)
        setActionLoading(false)
        if (error) {
          alert(`Error archiving survey: ${error}`)
        } else {
          setModalConfig((prev) => ({ ...prev, isOpen: false }))
          await fetchSurveys()
        }
      },
    })
  }

  const triggerDelete = (survey: SurveyWithCount) => {
    const hasResponses = (survey.response_count ?? 0) > 0
    setModalConfig({
      isOpen: true,
      title: `Delete "${survey.title}"?`,
      message: hasResponses ? (
        <span className="text-red-700 font-medium">
          Warning: This survey already has {survey.response_count} response
          {survey.response_count === 1 ? '' : 's'}. Deleting it will permanently erase the
          survey, its questions, and ALL collected student responses. This cannot be undone.
        </span>
      ) : (
        <span>
          This will permanently delete the survey and all its questions. This action cannot
          be undone.
        </span>
      ),
      confirmText: 'Delete Survey',
      variant: 'danger',
      action: async () => {
        setActionLoading(true)
        const { error } = await surveyService.deleteSurvey(survey.id)
        setActionLoading(false)
        if (error) {
          alert(`Error deleting survey: ${error}`)
        } else {
          setModalConfig((prev) => ({ ...prev, isOpen: false }))
          await fetchSurveys()
        }
      },
    })
  }

  const triggerDuplicate = async (survey: SurveyWithCount) => {
    setActionLoading(true)
    const { newId, error } = await surveyService.duplicateSurvey(survey.id)
    setActionLoading(false)
    if (error) {
      alert(`Error duplicating survey: ${error}`)
    } else if (newId) {
      await fetchSurveys()
      navigate(`/surveys/${newId}/edit`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Dashboard Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="flex items-center space-x-2.5 text-slate-900">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight leading-none">
                  Classroom Survey
                </span>
                <span className="text-xs text-slate-500 font-medium mt-0.5">Dashboard</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.email || 'Instructor'}</span>
            </div>

            <Link
              to="/surveys/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Survey</span>
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchSurveys}
              className="font-semibold underline hover:text-red-800 text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Controls: Search & Status Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search surveys by title..."
              className="block w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
                aria-label="Clear search input"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SurveyStatus)}
                aria-label="Filter by status"
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
              >
                <option value="all">Status: All</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                aria-label="Filter by date"
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
              >
                <option value="all">Date: All Time</option>
                <option value="today">Created Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                aria-label="Sort order"
                className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <button
              onClick={fetchSurveys}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              title="Refresh Survey List"
              aria-label="Refresh Survey List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Survey Cards List */}
        {loading && surveys.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">Loading surveys...</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          /* Empty States (UI.md Section 10) */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            {surveys.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  You have not created any surveys yet.
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                  Get started by creating your first in-class comprehension check.
                </p>
                <Link
                  to="/surveys/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Survey</span>
                </Link>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  No surveys match your search.
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Try adjusting your search query or status filter.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                  }}
                  className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 underline"
                >
                  Reset filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSurveys.map((survey) => {
              const formattedDate = new Date(survey.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <div
                  key={survey.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left info column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <h3 className="text-base font-semibold text-slate-900 truncate">
                        {survey.title}
                      </h3>
                      {renderStatusBadge(survey.status)}
                    </div>

                    {survey.description && (
                      <p className="text-xs text-slate-600 line-clamp-1 mb-2">
                        {survey.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span>Created: {formattedDate}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">
                        {survey.response_count ?? 0}{' '}
                        {survey.response_count === 1 ? 'response' : 'responses'}
                      </span>
                      {survey.public_slug && survey.status === 'active' && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-mono">
                            /s/{survey.public_slug}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right actions column */}
                  <div className="flex items-center flex-wrap gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    {/* Active Survey Actions */}
                    {survey.status === 'active' && (
                      <>
                        <Link
                          to={`/surveys/${survey.id}/present`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Present QR</span>
                        </Link>
                        <Link
                          to={`/surveys/${survey.id}/results`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Results</span>
                        </Link>
                        <button
                          onClick={() => triggerClose(survey)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Close</span>
                        </button>
                      </>
                    )}

                    {/* Draft Survey Actions */}
                    {survey.status === 'draft' && (
                      <>
                        <Link
                          to={`/surveys/${survey.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                        <button
                          onClick={() => triggerActivate(survey)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </button>
                      </>
                    )}

                    {/* Closed Survey Actions */}
                    {survey.status === 'closed' && (
                      <>
                        <Link
                          to={`/surveys/${survey.id}/results`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Results</span>
                        </Link>
                        <Link
                          to={`/surveys/${survey.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                        <button
                          onClick={() => triggerActivate(survey)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </button>
                      </>
                    )}

                    {/* Archived Survey Actions */}
                    {survey.status === 'archived' && (
                      <Link
                        to={`/surveys/${survey.id}/results`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Results</span>
                      </Link>
                    )}

                    {/* Common Actions */}
                    <button
                      onClick={() => triggerDuplicate(survey)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                      title="Duplicate survey"
                      aria-label={`Duplicate survey ${survey.title}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Duplicate</span>
                    </button>

                    {survey.status !== 'archived' && (
                      <button
                        onClick={() => triggerArchive(survey)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        title="Archive survey"
                        aria-label={`Archive survey ${survey.title}`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Archive</span>
                      </button>
                    )}

                    <button
                      onClick={() => triggerDelete(survey)}
                      className="inline-flex items-center gap-1.5 p-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
                      title="Delete survey"
                      aria-label={`Delete survey ${survey.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        variant={modalConfig.variant}
        isLoading={actionLoading}
        onConfirm={async () => {
          if (modalConfig.action) {
            await modalConfig.action()
          }
        }}
        onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
