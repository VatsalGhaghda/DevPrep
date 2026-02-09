import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-pink-300" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold">Something went wrong</div>
                <div className="text-sm text-slate-400 mt-1">Try refreshing the page. If it happens again, please report it.</div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Dismiss
              </button>
            </div>

            {this.state.error?.message && (
              <div className="mt-4 text-xs text-slate-500 break-words">{this.state.error.message}</div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
