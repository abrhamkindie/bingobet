import React, { useContext, useState, useCallback } from 'react';
import { Wallet, Check, CreditCard, ExternalLink, Banknote } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { errorMessage, fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Coin from '../components/ui/Coin.jsx';
import Button from '../components/ui/Button.jsx';

const PRESETS = [100, 200, 500, 1000, 2000, 5000];
const MIN = 10;

export default function DepositScreen({ onBack }) {
  const { player, reload, patchPlayer } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  const finalAmount = useCustom ? Number(custom) : amount;
  const valid = finalAmount >= MIN;

  const handleCustom = useCallback((e) => {
    const v = e.target.value.replace(/[^0-9]/g, '');
    setCustom(v);
    setUseCustom(true);
  }, []);

  const handleDeposit = async () => {
    if (!valid) { addToast(`Minimum deposit is ${MIN} ETB`, 'error'); return; }
    setLoading(true);
    try {
      const res = await api.deposit(finalAmount);
      if (res?.checkoutUrl) {
        addToast('Opening secure payment\u2026', 'info');
        const tg = window.Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(res.checkoutUrl);
        else window.open(res.checkoutUrl, '_blank');
      } else {
        if (res?.balance != null) patchPlayer({ wallet_balance: res.balance });
        addToast(`Deposited ${fmtETB(finalAmount)} ETB`, 'success');
      }
      reload();
      onBack?.();
    } catch (err) {
      addToast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell title="Deposit" subtitle="Add funds to your wallet" onBack={onBack}>
      {/* Balance */}
      <div className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur animate-slide-up transition-all duration-200 hover:border-white/20">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current balance</p>
          <p className="mt-1 text-2xl font-black text-white">
            {fmtETB(player?.wallet_balance)} <span className="text-sm text-coin-300">ETB</span>
          </p>
        </div>
        <Coin size={52}>₿</Coin>
      </div>

      {/* Presets */}
      <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400 animate-slide-up" style={{ animationDelay: '100ms' }}>Select amount</p>
      <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '150ms' }}>
        {PRESETS.map((val) => {
          const selected = !useCustom && amount === val;
          return (
            <button
              key={val}
              onClick={() => { setAmount(val); setUseCustom(false); setCustom(''); }}
              className={`relative overflow-hidden rounded-2xl border p-3.5 text-center transition-all duration-150 active:scale-95 ${
                selected
                  ? 'border-coin-400/40 bg-coin-500/15 shadow-coin-sm'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              {selected && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-coin-500/30 animate-scale-in">
                  <Check size={11} className="text-coin-200" />
                </span>
              )}
              <p className="text-base font-black text-white">{fmtETB(val)}</p>
              <p className="text-[10px] text-slate-400">ETB</p>
            </button>
          );
        })}
      </div>

      {/* Custom */}
      <p className="mb-3 mt-6 text-xs font-black uppercase tracking-wider text-slate-400 animate-slide-up" style={{ animationDelay: '200ms' }}>Or enter amount</p>
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200 animate-slide-up ${
          useCustom && custom
            ? 'border-coin-400/30 bg-coin-500/[0.06] shadow-[0_0_12px_rgba(251,191,36,0.08)]'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
        }`}
        style={{ animationDelay: '250ms' }}
      >
        <span className="text-lg font-black text-coin-300">ETB</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder={`Enter amount (min ${MIN})`}
          value={custom}
          onChange={handleCustom}
          onFocus={() => setUseCustom(true)}
          className="flex-1 bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-500"
        />
        {custom && (
          <button onClick={() => { setCustom(''); setUseCustom(false); }} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs text-slate-400 transition hover:bg-white/20 active:scale-90">{'\u2715'}</button>
        )}
      </div>
      {useCustom && custom && Number(custom) < MIN && (
        <p className="mt-1.5 text-xs text-rose-300 animate-slide-up">Minimum deposit is {MIN} ETB</p>
      )}

      <div className="mt-6 mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-slate-400 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <CreditCard size={13} className="shrink-0 text-coin-300" />
        You'll be redirected to Chapa to pay via Telebirr, CBE Birr, or Card.
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '350ms' }}>
        <Button block size="lg" loading={loading} disabled={!valid} onClick={handleDeposit}>
          <ExternalLink size={17} /> Deposit {fmtETB(finalAmount || 0)} ETB
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500 animate-slide-up" style={{ animationDelay: '400ms' }}>
        <span className="inline-flex items-center gap-1 transition hover:text-slate-300"><Banknote size={11} /> Telebirr</span>
        <span className="inline-flex items-center gap-1 transition hover:text-slate-300"><Banknote size={11} /> CBE Birr</span>
        <span className="inline-flex items-center gap-1 transition hover:text-slate-300"><CreditCard size={11} /> Card</span>
      </div>
    </ScreenShell>
  );
}
