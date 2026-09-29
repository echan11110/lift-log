import { Component } from 'react'

// The app had no error boundary, so any throw during render produced a blank
// white screen with no way back — and several mutation paths threw straight out
// of an onClick handler.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for debugging; the UI stays calm.
    console.error('[Lift Log] render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface px-6 text-center">
        <h1 className="font-condensed font-bold text-white uppercase tracking-wide text-2xl mb-2">
          Something broke
        </h1>
        <p className="text-zinc-400 text-sm mb-1 max-w-xs">
          The screen failed to render. Your logged sets are saved — reloading is safe.
        </p>
        <p className="text-zinc-600 text-xs mb-6 max-w-xs break-words">
          {this.state.error?.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-accent hover:bg-accentHov text-white font-condensed font-bold uppercase tracking-wider px-6 min-h-11 rounded-xl transition-colors cursor-pointer"
        >
          Reload
        </button>
      </div>
    )
  }
}
