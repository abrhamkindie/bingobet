import React, { useContext, useState } from 'react';
import { Gift, Flame, Check } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fmtETB, errorMessage } from '../i18n.js';
import { Skeleton } from './ui/states.jsx';

/**
 * Daily reward + streak claim card. Compact by default (Home); shows the 7-day
 * streak strip when `expanded`.
 */
export default function DailyRewardCard({ expanded = false }) {
  const { reload, patchPlayer } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { haptic } = useTelegram();
  const { data, loading, error, reload: reloadDaily } = useResource(api.getDaily, []);
  const [claiming, setClaiming] = useState(false);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return null; // silently hide on failure; not critical

  const { canClaim, streak = 0, rewardPreview = 0, nextClaimAt } = data;

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await api.claimDaily();
      haptic('success');
      addToast(`+${fmtETB(res.reward)} ETB daily reward!`, 'success');
      if (res.balance != null) patchPlayer({ wallet_balance: res.balance });
      reload();
      reloadDaily();
    } catch (err) {
      addToast(errorMessage(err), 'error');
      reloadDaily();
    } finally {
      setClaiming(false);
    }
  };

  const nextLabel = nextClaimAt
    ? new Date(nextClaimAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-coin-400/20 bg-gradient-to-br from-coin-500/[0.12] to-teal-500/[0.06] p-4 backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-coin-400/15 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-coin-300/20 bg-coin-500/15 text-coin-200">
          <Gift size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-white">Daily Reward</p>
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                <Flame size={10} /> {streak}d
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {canClaim ? `Claim +${fmtETB(rewardPreview)} ETB today` : `Next reward ${nextLabel ? `at ${nextLabel}` : 'tomorrow'}`}
          </p>
        </div>
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95 disabled:opacity-50 ${
            canClaim ? 'btn-coin text-amber-950' : 'border border-white/10 bg-white/5 text-slate-400'
          }`}
        >
          {canClaim ? (claiming ? '…' : 'Claim') : <Check size={16} className="text-emerald-300" />}
        </button>
      </div>

      {expanded && (
        <div className="relative mt-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const day = i + 1;
            const done = day <= streak;
            const today = day === streak + (canClaim ? 1 : 0) && canClaim;
            return (
              <div
                key={i}
                className={`grid aspect-square place-items-center rounded-xl text-[11px] font-bold ${
                  done ? 'bg-coin-500/25 text-coin-200' : today ? 'border border-coin-300/40 text-coin-200' : 'bg-white/[0.03] text-slate-500'
                }`}
              >
                {done ? <Check size={12} /> : `D${day}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
