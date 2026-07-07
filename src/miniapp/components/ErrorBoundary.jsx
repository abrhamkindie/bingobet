import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Mini app crash:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="isolate flex h-full flex-col items-center justify-center px-8 text-center"
          style={{
            background:
              'radial-gradient(circle at 50% -4%, rgba(45, 212, 191, 0.16), transparent 36%), radial-gradient(circle at 86% 14%, rgba(34, 211, 238, 0.12), transparent 34%), radial-gradient(circle at 8% 70%, rgba(251, 191, 36, 0.08), transparent 32%), linear-gradient(180deg, #0c1a16 0%, #091512 48%, #07110e 100%)',
          }}
        >
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
            <AlertTriangle size={30} className="text-rose-300" />
          </div>
          <h1 className="mt-5 text-lg font-black text-white">Something broke</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-6 rounded-2xl px-6 py-3 text-sm font-black text-amber-950 bg-gradient-to-b from-coin-300 via-coin-500 to-coin-600 shadow-[0_4px_0_0_#b45309,0_8px_18px_rgba(180,83,9,0.45)] active:translate-y-[3px] active:shadow-[0_1px_0_0_#b45309,0_3px_8px_rgba(180,83,9,0.4)] transition-all duration-150"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
