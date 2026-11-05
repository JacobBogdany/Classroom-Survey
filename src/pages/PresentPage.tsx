import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { surveyService, type SurveyDetail } from '../lib/survey-service'
import { ConfirmModal } from '../components/ConfirmModal'
import {
  ArrowLeft,
  BarChart3,
  Download,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  Copy,
  Check,
  AlertCircle,
  Users,
} from 'lucide-react'

export const PresentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [responseCount, setResponseCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Close Confirmation Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)

  // Container ref for Fullscreen
  const containerRef = useRef<HTMLDivElement>(null)

  // 1. Initial Load
  useEffect(() => {
    if (!id) return

    let isMounted = true
    const loadSurvey = async () => {
      setLoading(true)
      const { data, error } = await surveyService.getSurvey(id)
      if (!isMounted) return

      if (error || !data) {
        setError(error || 'Survey not found.')
      } else {
        setSurvey(data)
        setResponseCount(data.response_count)
      }
      setLoading(false)
    }

    loadSurvey()
    return () => {
      isMounted = false
    }
  }, [id])

  // 2. Realtime WebSocket subscription + 3s polling fallback for instant response updates
  useEffect(() => {
    if (!id || survey?.status !== 'active') return

    const fetchLatestCount = async () => {
      try {
        const { count, error } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', id)

        if (!error && count !== null) {
          setResponseCount(count)
        }
      } catch (err) {
        console.error('Response count fetch error:', err)
      }
    }

    // A. Supabase Realtime channel
    const channel = supabase
      .channel(`present-responses-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `survey_id=eq.${id}`,
        },
        () => {
          fetchLatestCount()
        }
      )
      .subscribe()

    // B. Periodic fallback
    const interval = setInterval(fetchLatestCount, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [id, survey?.status])

  // 3. Close Survey
  const handleCloseSurvey = async () => {
    if (!id) return
    setActionLoading(true)
    const { error } = await surveyService.closeSurvey(id)
    setActionLoading(false)
    if (error) {
      alert(`Error closing survey: ${error}`)
    } else {
      setIsCloseModalOpen(false)
      // Refresh survey state
      const { data } = await surveyService.getSurvey(id)
      if (data) {
        setSurvey(data)
      }
    }
  }

  // 4. Activate Survey (if currently Draft or Closed)
  const handleActivateSurvey = async () => {
    if (!id) return
    setActionLoading(true)
    const { error } = await surveyService.activateSurvey(id)
    setActionLoading(false)
    if (error) {
      alert(`Error activating survey: ${error}`)
    } else {
      const { data } = await surveyService.getSurvey(id)
      if (data) {
        setSurvey(data)
      }
    }
  }

  // 5. Download QR Code PNG
  const handleDownloadQR = () => {
    const canvas = document.getElementById('present-qr-canvas') as HTMLCanvasElement | null
    if (!canvas || !survey) return

    const image = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    const safeTitle = survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.download = `${safeTitle}_qr.png`
    link.href = image
    link.click()
  }

  // 6. Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 7. Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base font-medium text-slate-300">Loading presentation...</p>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center border border-slate-700">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Survey Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">{error || 'Could not load presentation.'}</p>
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

  // Construct URLs
  const slug = survey.public_slug || survey.id
  const fullUrl = `${window.location.origin}/s/${slug}`
  const displayUrl = `${window.location.host}/s/${slug}`

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none"
    >
      {/* Top Bar for Instructor Controls */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded">
            Projector Mode
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Projector Content (Centered, High-Visibility for Lecture Halls) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full">
        {/* Survey Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight max-w-3xl">
          {survey.title}
        </h1>

        {survey.description && (
          <p className="text-base sm:text-lg text-slate-400 mb-8 max-w-xl font-normal">
            {survey.description}
          </p>
        )}

        {/* Inactive Survey Notice */}
        {survey.status !== 'active' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/50 border border-amber-800/80 max-w-md w-full text-amber-200 text-sm flex items-center justify-between gap-3">
            <span>This survey is currently <strong>{survey.status}</strong>.</span>
            <button
              onClick={handleActivateSurvey}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Activate Now</span>
            </button>
          </div>
        )}

        {/* High-Resolution QR Code Container */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl shadow-indigo-950/60 border border-slate-700/50 mb-8 inline-block">
          <QRCodeCanvas
            id="present-qr-canvas"
            value={fullUrl}
            size={280}
            level="H"
            marginSize={2}
          />
        </div>

        {/* Readable Fallback URL (UI.md Section 6 Requirement) */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-slate-400 text-sm sm:text-base font-medium">Join at:</span>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg sm:text-2xl font-mono font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4 tracking-wide"
          >
            {displayUrl}
          </a>
          <button
            onClick={() => handleCopyUrl(fullUrl)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Copy URL"
            aria-label={copied ? 'URL Copied' : 'Copy survey join URL'}
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        {/* Live Response Counter */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-200 text-base sm:text-lg font-semibold shadow-inner mb-8">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <Users className="w-5 h-5 text-indigo-400" />
          <span>
            Responses: <span className="text-white font-bold">{responseCount}</span>
          </span>
          <span className="text-xs text-slate-500 font-normal">
            (updates automatically)
          </span>
        </div>

        {/* Bottom Projection Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to={`/surveys/${survey.id}/results`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-900/50"
          >
            <BarChart3 className="w-4 h-4" />
            <span>View Results</span>
          </Link>

          <button
            onClick={handleDownloadQR}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download QR PNG</span>
          </button>

          {survey.status === 'active' && (
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-amber-950/80 hover:text-amber-300 text-slate-300 font-semibold text-sm border border-slate-700 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>Close Survey</span>
            </button>
          )}
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        Classroom Survey • Screen optimized for projection
      </footer>

      {/* Close Survey Confirmation Modal */}
      <ConfirmModal
        isOpen={isCloseModalOpen}
        title={`Close "${survey.title}"?`}
        message={
          <span>
            Closing this survey will immediately stop accepting student responses. Students
            currently on the page will no longer be able to submit.
          </span>
        }
        confirmText="Close Survey"
        variant="warning"
        isLoading={actionLoading}
        onConfirm={handleCloseSurvey}
        onCancel={() => setIsCloseModalOpen(false)}
      />
    </div>
  )
}
