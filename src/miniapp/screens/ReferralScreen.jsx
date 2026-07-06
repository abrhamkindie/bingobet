import React, { useContext, useState } from 'react';
import { Users, Copy, Send, Gift, Check, UserPlus } from 'lucide-react';
import * as api from '../api.js';
import { ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import Coin from '../components/ui/Coin.jsx';
import { Spinner, EmptyState, ErrorState } from '../components/ui/states.jsx';

export default function ReferralScreen({ onBack }) {
  const { addToast } = useContext(ToastContext);
  const { tg, haptic } = useTelegram();
  const { data, loading, error, reload } = useResource(api.getReferrals, []);
  const [copied, setCopied] = useState(false);

  const link = data?.link || '';
  const code = data?.code || '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || code);
      setCopied(true);
      haptic('success');
      addToast('Invite link copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch { addToast('Could not copy', 'error'); }
  };

  const share = () => {
    haptic('light');
    const text = `Join me on BetBingo and win big! 🎰`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  };

  return (
    <ScreenShell title="Invite Friends" subtitle="Earn a bonus for every friend" Icon={Users} onBack={onBack}>
      {loading ? (
        <Spinner label="Loading…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="relative mb-4 overflow-hidden rounded-3xl border border-coin-400/20 bg-gradient-to-br from-coin-500/15 to-teal-600/[0.08] p-5 text-center">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-coin-400/15 blur-2xl" />
            <Coin size={64} floating className="mx-auto">🎁</Coin>
            <h3 className="mt-3 text-lg font-black text-white">Give {fmtETB(data?.bonusAmount || 0)}, Get {fmtETB(data?.bonusAmount || 0)} ETB</h3>
            <p className="mt-1 text-sm text-slate-400">
              You earn a bonus when a friend joins with your link and makes their first deposit.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <StatTile label="Invited" value={data?.count ?? 0} Icon={UserPlus} />
            <StatTile label="Earned" value={`${fmtETB(data?.earned)} ETB`} tone="emerald" Icon={Gift} />
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Your invite code</p>
          <button
            onClick={copy}
            className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition active:scale-[0.99]"
          >
            <span className="font-mono text-lg font-black tracking-widest text-coin-300">{code || '—'}</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
              {copied ? <><Check size={14} className="text-emerald-300" /> Copied</> : <><Copy size={14} /> Copy</>}
            </span>
          </button>

          <Button block size="lg" onClick={share} disabled={!link}>
            <Send size={17} /> Share on Telegram
          </Button>

          <p className="mb-2 mt-6 text-xs font-black uppercase tracking-wider text-slate-400">Your invitees</p>
          {(!data?.invitees || data.invitees.length === 0) ? (
            <EmptyState Icon={Users} title="No invitees yet" text="Share your link to start earning." />
          ) : (
            <div className="space-y-2">
              {data.invitees.map((inv, i) => (
                <Card key={inv.id ?? i} className="animate-slide-up flex items-center gap-3 p-3" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-coin-300 text-sm font-black">
                    {(inv.name || inv.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{inv.name || inv.username || 'Player'}</p>
                    <p className="text-xs text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  {inv.rewarded
                    ? <span className="text-xs font-bold text-emerald-300">+{fmtETB(data.bonusAmount)} ETB</span>
                    : <span className="text-[10px] font-bold uppercase text-slate-500">Pending</span>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}
