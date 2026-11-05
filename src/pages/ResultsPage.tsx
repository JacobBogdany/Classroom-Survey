import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  surveyService,
  type SurveyResultsData,
} from '../lib/survey-service'
import { generateSurveyCSV, downloadCSV } from '../lib/csv-export'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import {
  ArrowLeft,
  QrCode,
  RefreshCw,
  Download,
  AlertCircle,
  Users,
  Clock,
} from 'lucide-react'

// Accessible palette for bar charts
const BAR_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const [resultsData, setResultsData] = useState<SurveyResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLiveActive, setIsLiveActive] = useState(false)

  const loadResults = useCallback(async (isManualRefresh = false) => {
    if (!id) return
    if (isManualRefresh) {
      setRefreshing(true)
    }
    setError(null)

    const { data, error } = await surveyService.getSurveyResults(id)
    if (error) {
      setError(error)
    } else {
      setResultsData(data)
    }

    setLoading(false)
    setRefreshing(false)
  }, [id])

  // 1. Initial Load
  useEffect(() => {
    let ignore = false
    if (!id) return

    void (async () => {
      const { data, error } = await surveyService.getSurveyResults(id)
      if (!ignore) {
        if (error) {
          setError(error)
        } else {
          setResultsData(data)
        }
        setLoading(false)
      }
    })()

    return () => {
      ignore = true
    }
  }, [id])

  // 2. Realtime WebSocket subscription for live-updating charts (Phase 16)
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`results-live-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `survey_id=eq.${id}`,
        },
        () => {
          // Instantly refresh analytics upon new student submission
          loadResults(false)
        }
      )
      .subscribe((status) => {
        setIsLiveActive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, loadResults])

  const [exportingCSV, setExportingCSV] = useState(false)

  // Full response-level CSV export matching API.md Section 12 & RFC 4180
  const handleExportCSV = async () => {
    if (!id || !resultsData) return

    setExportingCSV(true)
    const { data: rawData, error: rawErr } = await surveyService.fetchSurveyRawData(id)
    setExportingCSV(false)

    if (rawErr || !rawData) {
      alert(`Error exporting CSV: ${rawErr || 'Failed to fetch responses.'}`)
      return
    }

    const csvString = generateSurveyCSV(rawData)
    const safeTitle = resultsData.survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    downloadCSV(`${safeTitle}_responses.csv`, csvString)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Loading survey results...</p>
      </div>
    )
  }

  if (error || !resultsData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Results Error</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Could not load results.'}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    )
  }

  const { survey, total_responses, questions } = resultsData

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-slate-900">
                Survey Results
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                Aggregated Responses & Analytics
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {isLiveActive && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Realtime
              </span>
            )}

            <button
              onClick={() => loadResults(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
              title="Refresh Results"
              aria-label="Refresh Results"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to={`/surveys/${survey.id}/present`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <QrCode className="w-4 h-4" />
              <span>Present QR</span>
            </Link>

            <button
              onClick={handleExportCSV}
              disabled={total_responses === 0 || exportingCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
              title="Export CSV"
              aria-label="Export results to CSV"
            >
              <Download className={`w-4 h-4 ${exportingCSV ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">
                {exportingCSV ? 'Exporting...' : 'Export CSV'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Survey Summary Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {survey.title}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  survey.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {survey.status}
              </span>
            </div>
            {survey.description && (
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">{survey.description}</p>
            )}

            <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-2 flex-wrap">
              <span>
                Created{' '}
                {new Date(survey.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {resultsData.first_response_at && (
                <>
                  <span>•</span>
                  <span>
                    First response:{' '}
                    {new Date(resultsData.first_response_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </>
              )}
              {resultsData.last_response_at &&
                resultsData.last_response_at !== resultsData.first_response_at && (
                  <>
                    <span>•</span>
                    <span>
                      Latest:{' '}
                      {new Date(resultsData.last_response_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </>
                )}
            </div>
          </div>

          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-900 shrink-0">
            <Users className="w-6 h-6 text-indigo-600" />
            <div>
              <span className="block text-2xl font-black leading-none">{total_responses}</span>
              <span className="text-xs font-medium text-indigo-700">
                {total_responses === 1 ? 'Total Response' : 'Total Responses'}
              </span>
            </div>
          </div>
        </div>

        {/* Empty State when no responses yet (UI.md Section 10) */}
        {total_responses === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No responses yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              Display the QR code on your classroom projector so students can scan and vote.
            </p>
            <Link
              to={`/surveys/${survey.id}/present`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <QrCode className="w-4 h-4" />
              <span>Present QR Code</span>
            </Link>
          </div>
        ) : (
          /* Question Results Cards */
          <div className="space-y-6">
            {questions.map((question, qIndex) => {
              // Prepare Recharts bar chart data
              const chartData = question.choices.map((c) => ({
                name: c.choice_text,
                votes: c.count,
                percentage: c.percentage,
              }))

              return (
                <div
                  key={question.question_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6"
                >
                  {/* Question Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
                        {qIndex + 1}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {question.question_text}
                      </h2>
                    </div>

                    <div className="text-xs text-slate-500 font-medium shrink-0 ml-10 sm:ml-0">
                      <span>{question.response_count} answered</span>
                      {question.unanswered_count > 0 && (
                        <span className="text-amber-600 ml-2">
                          • {question.unanswered_count} skipped
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recharts Bar Chart (Horizontal layout) */}
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                      >
                        <XAxis type="number" domain={[0, 'dataMax + 2']} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fill: '#334155', fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} votes`, 'Count']}
                          labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        <Bar dataKey="votes" radius={[0, 6, 6, 0]} maxBarSize={32}>
                          {chartData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Accessible Numeric Breakdown (UI.md Section 9: readable without relying only on color) */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Detailed Breakdown
                    </h3>
                    <div className="space-y-2.5">
                      {question.choices.map((choice, cIndex) => {
                        const letter = String.fromCharCode(65 + cIndex)

                        return (
                          <div
                            key={choice.choice_id}
                            className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 text-xs font-bold text-slate-400">
                                {letter}.
                              </span>
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {choice.choice_text}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 sm:ml-4">
                              {/* Inline mini progress bar */}
                              <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${choice.percentage}%`,
                                    backgroundColor: BAR_COLORS[cIndex % BAR_COLORS.length],
                                  }}
                                />
                              </div>

                              <div className="text-right w-20">
                                <span className="text-sm font-bold text-slate-900">
                                  {choice.count}
                                </span>
                                <span className="text-xs text-slate-500 ml-1">
                                  ({choice.percentage}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Clearly label unanswered questions (TODO Phase 9) */}
                      {question.unanswered_count > 0 && (
                        <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100 flex items-center justify-between text-xs text-amber-800">
                          <span className="font-medium">Unanswered / Skipped</span>
                          <span className="font-bold">
                            {question.unanswered_count} (
                            {Math.round((question.unanswered_count / total_responses) * 1000) / 10}
                            %)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
