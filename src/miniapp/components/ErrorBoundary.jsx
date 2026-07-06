import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Catches render-time crashes so the whole mini app never white-screens. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Mini app crash:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="coin-bg flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
            <AlertTriangle size={30} className="text-rose-300" />
          </div>
          <h1 className="mt-5 text-lg font-black text-white">Something broke</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            className="btn-coin mt-6 rounded-2xl px-6 py-3 text-sm font-black text-amber-950"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
