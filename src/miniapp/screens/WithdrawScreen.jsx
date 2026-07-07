import React, { useContext, useState, useCallback } from 'react';
import { Wallet, ArrowDownToLine, Info, Check } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { errorMessage, fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Coin from '../components/ui/Coin.jsx';
import Button from '../components/ui/Button.jsx';

const MIN = 50;

export default function WithdrawScreen({ onBack }) {
  const { player, reload, patchPlayer } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const balance = Number(player?.wallet_balance || 0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const value = Number(amount);
  const tooLow = value > 0 && value < MIN;
  const tooHigh = value > balance;
  const valid = value >= MIN && value <= balance;

  const handleChange = useCallback((e) => setAmount(e.target.value.replace(/[^0-9]/g, '')), []);
  const setPct = (pct) => setAmount(String(Math.floor(balance * pct)));

  const handleWithdraw = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await api.withdraw(value);
      patchPlayer({ wallet_balance: balance - value });
      reload();
      setDone(true);
      addToast('Withdrawal requested', 'success');
    } catch (err) {
      addToast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <ScreenShell title="Withdraw" onBack={onBack}>
        <div className="flex flex-col items-center py-10 text-center animate-slide-up">
          <div className="grid h-20 w-20 animate-bounce-in place-items-center rounded-full bg-emerald-500/15 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="mt-5 text-xl font-black text-white">Request submitted</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            Your withdrawal of {fmtETB(value)} ETB is pending. You'll be notified once it's processed.
          </p>
          <Button className="mt-6" onClick={onBack}>Back to Profile</Button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Withdraw" subtitle="Cash out your balance" onBack={onBack}>
      {/* Balance */}
      <div className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur animate-slide-up transition-all duration-200 hover:border-white/20">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Available</p>
          <p className="mt-1 text-2xl font-black text-white">{fmtETB(balance)} <span className="text-sm text-coin-300">ETB</span></p>
        </div>
        <Coin size={52}>₿</Coin>
      </div>

      {/* Amount input */}
      <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400 animate-slide-up" style={{ animationDelay: '100ms' }}>Amount to withdraw</p>
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200 animate-slide-up ${
          amount && valid
            ? 'border-coin-400/30 bg-coin-500/[0.06] shadow-[0_0_12px_rgba(251,191,36,0.08)]'
            : amount && !valid
            ? 'border-rose-400/30 bg-rose-500/[0.05] shadow-[0_0_8px_rgba(239,68,68,0.08)]'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
        }`}
        style={{ animationDelay: '150ms' }}
      >
        <span className="text-lg font-black text-coin-300">ETB</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder={`Min ${MIN}`}
          value={amount}
          onChange={handleChange}
          className="flex-1 bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-500"
        />
      </div>
      {tooLow && <p className="mt-1.5 text-xs text-rose-300 animate-slide-up">Minimum withdrawal is {MIN} ETB</p>}
      {tooHigh && <p className="mt-1.5 text-xs text-rose-300 animate-slide-up">Amount exceeds your balance</p>}

      {/* Quick percentages */}
      <div className="mt-3 grid grid-cols-4 gap-2 animate-slide-up" style={{ animationDelay: '200ms' }}>
        {[[0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, 'Max']].map(([pct, label]) => (
          <button
            key={label}
            onClick={() => setPct(pct)}
            disabled={balance < MIN}
            className="rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-bold text-slate-300 transition-all duration-150 hover:border-coin-400/25 hover:bg-coin-500/5 hover:text-coin-200 active:scale-95 disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-slate-400 animate-slide-up" style={{ animationDelay: '250ms' }}>
        <Info size={13} className="shrink-0 text-coin-300" />
        Withdrawals are reviewed and paid out manually, usually within 24 hours.
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
        <Button block size="lg" loading={loading} disabled={!valid} onClick={handleWithdraw} variant="primary">
          <ArrowDownToLine size={17} /> Withdraw {fmtETB(value || 0)} ETB
        </Button>
      </div>
    </ScreenShell>
  );
}
