import React, { useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  // Support closing with Escape key for keyboard accessibility
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-6 h-6 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />
      default:
        return <Info className="w-6 h-6 text-indigo-600" />
    }
  }

  const getButtonStyles = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500'
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={isLoading ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 sm:mx-0 sm:h-10 sm:w-10">
                {getIcon()}
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <div className="flex items-center justify-between">
                  <h3
                    id="confirm-modal-title"
                    className="text-base font-semibold leading-6 text-slate-900"
                  >
                    {title}
                  </h3>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={onCancel}
                    className="text-slate-400 hover:text-slate-500 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {message}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${getButtonStyles()}`}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className="mt-2 sm:mt-0 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

