import React, { useState, useContext, useCallback, useEffect } from 'react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { ArrowLeft, Wallet, Check, CreditCard, ExternalLink, RefreshCw, Banknote } from 'lucide-react';

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function DepositScreen({ navigate, onBack }) {
  const { player, reload } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [amount, setAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePreset = useCallback((val) => {
    setAmount(val);
    setUseCustom(false);
    setCustomAmount('');
  }, []);

  const handleCustomChange = useCallback((e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setUseCustom(true);
    if (val) setAmount(Number(val));
  }, []);

  const handleDeposit = useCallback(async () => {
    const finalAmount = useCustom ? Number(customAmount) : amount;
    if (!finalAmount || finalAmount < 10) {
      addToast('Minimum deposit is 10 ETB', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await api.deposit(finalAmount);
      if (result?.checkoutUrl) {
        addToast('Opening payment page...', 'info');
        window.open(result.checkoutUrl, '_blank');
      } else {
        addToast('Deposit initiated successfully!', 'success');
      }
      reload();
      if (onBack) onBack();
    } catch (err) {
      const msg = err.message === 'INVALID_AMOUNT' ? 'Invalid amount. Minimum is 10 ETB.'
        : err.message || 'Deposit failed. Please try again.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [useCustom, customAmount, amount, addToast, reload, onBack]);

  return (
    <div className="min-h-full bg-gradient-dark px-4 pb-6 pt-4">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur transition-all hover:border-white/20 hover:bg-white/10 active:scale-95">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Deposit</h1>
            <p className="text-xs text-slate-400">Add funds to your wallet</p>
          </div>
        </div>
      </div>

      {/* Balance card */}
      <div className="mb-6 animate-fade-in-up rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Balance</p>
            <p className="mt-1 text-2xl font-black text-white animate-count-up">
              {Number(player?.wallet_balance || 0).toLocaleString()}{' '}
              <span className="text-sm font-bold text-cyan-300">ETB</span>
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-400/10 shadow-[0_0_14px_rgba(34,211,238,0.1)]">
            <Wallet size={22} className="text-cyan-300" />
          </div>
        </div>
      </div>

      {/* Amount selection */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Select Amount</p>
        <div className="grid grid-cols-3 gap-3">
          {PRESET_AMOUNTS.map((val, i) => (
            <button
              key={val}
              onClick={() => handlePreset(val)}
              className={`relative overflow-hidden rounded-xl border p-3 text-center backdrop-blur transition-all duration-200 active:scale-95 ${
                !useCustom && amount === val
                  ? 'border-cyan-300/30 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {!useCustom && amount === val && (
                <div className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20">
                  <Check size={10} className="text-cyan-300" />
                </div>
              )}
              <p className="text-base font-bold text-white">{val}</p>
              <p className="text-[10px] text-slate-400">ETB</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Or Enter Custom Amount</p>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 backdrop-blur transition-all duration-200 ${
          useCustom && customAmount
            ? 'border-cyan-300/25 bg-cyan-500/8 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
            : 'border-white/10 bg-white/[0.03]'
        }`}>
          <span className="text-lg font-bold text-cyan-300">ETB</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter amount (min 10)"
            value={customAmount}
            onChange={handleCustomChange}
            onFocus={() => setUseCustom(true)}
            className="flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-slate-500"
          />
          {customAmount && (
            <button onClick={() => { setCustomAmount(''); setUseCustom(false); }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400 hover:bg-white/20">
              ✕
            </button>
          )}
        </div>
        {useCustom && customAmount && Number(customAmount) < 10 && (
          <p className="mt-1.5 text-xs text-red-300">Minimum deposit is 10 ETB</p>
        )}
      </div>

      {/* Info */}
      <div className="mb-6 animate-fade-in-up rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur" style={{ animationDelay: '0.35s' }}>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          <CreditCard size={12} className="text-cyan-300" />
          You will be redirected to Chapa to complete payment via Telebirr, CBE Birr, or Card
        </p>
      </div>

      {/* Deposit button */}
      <button
        onClick={handleDeposit}
        disabled={loading || (!useCustom && !amount) || (useCustom && (!customAmount || Number(customAmount) < 10))}
        className="group relative w-full animate-fade-in-up overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-4 text-sm font-bold text-white shadow-[0_0_24px_rgba(34,211,238,0.2)] transition-all duration-200 hover:from-cyan-500 hover:to-cyan-400 hover:shadow-[0_0_36px_rgba(34,211,238,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ animationDelay: '0.4s' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <span className="relative inline-flex items-center gap-2">
          {loading ? (
            <><RefreshCw size={16} className="animate-spin" /> Opening payment...</>
          ) : (
            <><ExternalLink size={16} /> Deposit {useCustom && customAmount ? Number(customAmount).toLocaleString() : amount} ETB</>
          )}
        </span>
      </button>

      {/* Payment methods */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Banknote size={10} /> Telebirr</span>
        <span className="inline-flex items-center gap-1"><Banknote size={10} /> CBE Birr</span>
        <span className="inline-flex items-center gap-1"><CreditCard size={10} /> Card</span>
      </div>
    </div>
  );
}
