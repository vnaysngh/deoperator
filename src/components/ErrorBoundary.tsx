'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('Error caught by boundary:', error, errorInfo)

    // Check if this is a browser extension error
    const isExtensionError =
      error.message?.includes('chrome.runtime') ||
      error.message?.includes('Extension ID') ||
      error.stack?.includes('chrome-extension://')

    if (isExtensionError) {
      console.warn(
        'Browser extension error detected. This is not a critical error and the app will continue to function.'
      )
      // For extension errors, we can reset the error boundary after a short delay
      setTimeout(() => {
        this.setState({ hasError: false, error: null })
      }, 100)
    }
  }

  render() {
    if (this.state.hasError) {
      const isExtensionError =
        this.state.error?.message?.includes('chrome.runtime') ||
        this.state.error?.message?.includes('Extension ID') ||
        this.state.error?.stack?.includes('chrome-extension://')

      // For extension errors, show nothing or minimal UI since we'll auto-recover
      if (isExtensionError) {
        return this.props.children
      }

      // For other errors, show error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-8 max-w-md w-full border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">
                Something went wrong
              </h2>
            </div>
            <p className="text-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
