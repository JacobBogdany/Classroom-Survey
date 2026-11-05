import React, { useState } from 'react'
import {
  parseSurveyFromJSON,
  parseSurveyFromMarkdown,
  type SurveyImportData,
} from '../lib/survey-import-export'
import { FileText, Code2, AlertCircle, X, Check, Upload } from 'lucide-react'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (data: SurveyImportData) => void
}

const SAMPLE_MARKDOWN = `# CS 101 Mid-Lecture Poll
Quick comprehension check for today's lecture.

1. What is the time complexity of searching a binary search tree in the worst case?
- O(1)
- O(log n)
- O(n)
- O(n^2)

2. A recursive function must always have a base case to terminate.
- True
- False`

const SAMPLE_JSON = `{
  "title": "Recursion Concept Check",
  "description": "Quick check on base cases and call stacks",
  "questions": [
    {
      "question_text": "What happens if a recursive function lacks a base case?",
      "question_type": "multiple_choice",
      "choices": [
        { "choice_text": "Stack overflow error" },
        { "choice_text": "Compiles faster" },
        { "choice_text": "Returns null" }
      ]
    },
    {
      "question_text": "Tail recursion can be optimized into an iterative loop.",
      "question_type": "true_false",
      "choices": [
        { "choice_text": "True" },
        { "choice_text": "False" }
      ]
    }
  ]
}`

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [tab, setTab] = useState<'markdown' | 'json'>('markdown')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleImport = () => {
    setError(null)
    const content = text.trim()
    if (!content) {
      setError('Please paste your survey content or load a sample.')
      return
    }

    try {
      if (tab === 'markdown') {
        const data = parseSurveyFromMarkdown(content)
        onImport(data)
        onClose()
      } else {
        const data = parseSurveyFromJSON(content)
        onImport(data)
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to parse survey data. Check format.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setText(content)
        if (file.name.endsWith('.json')) {
          setTab('json')
        } else if (file.name.endsWith('.md')) {
          setTab('markdown')
        }
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h3 id="import-modal-title" className="text-lg font-bold text-slate-900">
                Import Survey
              </h3>
              <p className="text-xs text-slate-500">
                Quickly populate your survey from Markdown text or a JSON backup file.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Format Tabs & File Upload */}
          <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTab('markdown')
                  setError(null)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === 'markdown'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Markdown Format</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('json')
                  setError(null)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === 'json'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON Format</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload file (.md, .json)</span>
              <input
                type="file"
                accept=".md,.json,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Editor Body */}
          <div className="p-6 space-y-3">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Paste {tab === 'markdown' ? 'Markdown' : 'JSON'} below:</span>
              <button
                type="button"
                onClick={() => setText(tab === 'markdown' ? SAMPLE_MARKDOWN : SAMPLE_JSON)}
                className="text-indigo-600 hover:text-indigo-700 font-semibold underline"
              >
                Load Sample Template
              </button>
            </div>

            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                tab === 'markdown'
                  ? `# Survey Title\nDescription...\n\n1. Question\n- Choice A\n- Choice B`
                  : `{\n  "title": "...",\n  "questions": [...]\n}`
              }
              className="w-full font-mono text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-y"
            />
          </div>

          {/* Footer Controls */}
          <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Import Questions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

