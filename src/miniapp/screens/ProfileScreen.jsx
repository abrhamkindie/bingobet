import React, { useContext, useState } from 'react';
import {
  User, Shield, Wallet, Plus, ArrowDownToLine, ShoppingBag, Trophy,
  History, Users, BarChart3, Languages, HelpCircle, ChevronRight,
  CreditCard, Sparkles, Check,
} from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Coin from '../components/ui/Coin.jsx';
import DailyRewardCard from '../components/DailyRewardCard.jsx';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/states.jsx';

export default function ProfileScreen({ navigate }) {
  const { player, reload } = useContext(PlayerContext);
  const [section, setSection] = useState(null);

  if (section === 'transactions') return <TransactionsSection onBack={() => setSection(null)} />;
  if (section === 'language') return <LanguageSection onBack={() => setSection(null)} player={player} reload={reload} />;
  if (section === 'help') return <HelpSection onBack={() => setSection(null)} />;

  const initials = (player?.name || player?.username || 'B').slice(0, 1).toUpperCase();
  const isAdmin = player?.role === 'admin';

  const menu = [
    ...(isAdmin ? [{ key: 'admin', label: 'Admin Panel', Icon: Shield, desc: 'Manage games & payouts', action: () => window.open('/admin', '_blank') }] : []),
    { key: 'referrals', label: 'Invite Friends', Icon: Users, desc: 'Earn bonus for every friend', nav: 'referrals' },
    { key: 'leaderboard', label: 'Leaderboard', Icon: BarChart3, desc: 'Top winners this week', nav: 'leaderboard' },
    { key: 'transactions', label: 'Transactions', Icon: History, desc: 'Deposits, buys & winnings' },
    { key: 'language', label: 'Language', Icon: Languages, desc: player?.language_pref === 'am' ? 'አማርኛ' : 'English' },
    { key: 'help', label: 'Help & Support', Icon: HelpCircle, desc: 'How to play & get help' },
  ];

  return (
    <ScreenShell className="pt-3">
      {/* Identity */}
      <div className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-coin-400/12 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-coin-300/20 bg-gradient-to-br from-coin-500/25 to-amber-700/10 text-2xl font-black text-white shadow-coin-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black text-white">{player?.name || 'Player'}</h1>
            <p className="truncate text-sm text-slate-400">{player?.username ? `@${player.username}` : `ID: ${player?.id ?? '-'}`}</p>
            <div className="mt-1.5">
              {isAdmin
                ? <Badge tone="coin" Icon={Shield}>Admin</Badge>
                : <Badge Icon={User}>Player</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Wallet size={12} /> Wallet balance
            </p>
            <p className="mt-1 text-3xl font-black text-white text-glow-gold">
              {fmtETB(player?.wallet_balance)} <span className="text-sm text-coin-300">ETB</span>
            </p>
          </div>
          <Coin size={52}>₿</Coin>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button size="sm" onClick={() => navigate('deposit')}><Plus size={15} /> Deposit</Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('withdraw')}><ArrowDownToLine size={15} /> Withdraw</Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <MiniStat Icon={ShoppingBag} label="Spent" value={`${fmtETB(player?.total_spent)} ETB`} />
          <MiniStat Icon={Trophy} label="Won" value={`${fmtETB(player?.total_won)} ETB`} tone="emerald" />
        </div>
      </Card>

      <div className="mb-4"><DailyRewardCard expanded /></div>

      {/* Menu */}
      <div className="space-y-2">
        {menu.map((item, i) => (
          <button
            key={item.key}
            onClick={() => (item.action ? item.action() : item.nav ? navigate(item.nav) : setSection(item.key))}
            className="group flex w-full animate-slide-up items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left backdrop-blur transition hover:border-coin-400/20 hover:bg-white/[0.07] active:scale-[0.99]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-coin-300 transition group-hover:bg-coin-500/10">
              <item.Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">{item.label}</p>
              <p className="truncate text-xs text-slate-400">{item.desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-500 transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

function MiniStat({ Icon, label, value, tone = 'default' }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
      <p className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-400"><Icon size={10} /> {label}</p>
      <p className={`text-sm font-black ${tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function TransactionsSection({ onBack }) {
  const { data, loading, error, reload } = useResource(() => api.getTransactions(), []);
  const txs = data?.transactions || [];

  return (
    <ScreenShell title="Transactions" subtitle="Deposits, buys & winnings" onBack={onBack}>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : txs.length === 0 ? (
        <EmptyState Icon={History} title="No transactions yet" text="Deposit and play to see history." />
      ) : (
        <div className="space-y-2">
          {txs.map((tx, i) => {
            const credit = ['deposit', 'winnings', 'bonus', 'referral_bonus', 'refund', 'payout'].includes(tx.type);
            const Icon = tx.type === 'deposit' ? CreditCard
              : tx.type === 'winnings' || tx.type === 'payout' ? Trophy
              : tx.type === 'bonus' || tx.type === 'referral_bonus' ? Sparkles
              : ShoppingBag;
            return (
              <Card key={tx.id} className="animate-slide-up flex items-center gap-3 p-3" style={{ animationDelay: `${i * 35}ms` }}>
                <div className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 ${credit ? 'text-emerald-300' : 'text-slate-400'}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold capitalize text-white">{tx.type?.replace(/_/g, ' ')}</p>
                    <span className={`text-sm font-black ${credit ? 'text-emerald-300' : 'text-rose-400'}`}>
                      {credit ? '+' : '-'}{fmtETB(tx.amount)} ETB
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {tx.game_title || tx.reference || tx.status} · {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ScreenShell>
  );
}

function LanguageSection({ onBack, player, reload }) {
  const { addToast } = useContext(ToastContext);
  const current = player?.language_pref || 'en';
  const langs = [
    { key: 'en', label: 'English', desc: 'English interface' },
    { key: 'am', label: 'አማርኛ', desc: 'Amharic interface' },
  ];
  const change = async (lang) => {
    try {
      await api.setLanguage(lang);
      addToast(lang === 'am' ? 'ቋንቋ ተቀየረ' : 'Language changed', 'success');
      reload();
    } catch { addToast('Failed to change language', 'error'); }
  };

  return (
    <ScreenShell title="Language" subtitle="Interface language" onBack={onBack}>
      <div className="space-y-3">
        {langs.map((l) => {
          const active = current === l.key;
          return (
            <button
              key={l.key}
              onClick={() => change(l.key)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${active ? 'border-coin-400/30 bg-coin-500/10 shadow-coin-sm' : 'border-white/10 bg-white/[0.04] hover:border-white/20'}`}
            >
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${active ? 'bg-coin-500/20 text-coin-200' : 'bg-white/5 text-slate-400'}`}><Languages size={18} /></div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">{l.label}</p>
                <p className="text-xs text-slate-400">{l.desc}</p>
              </div>
              {active && <div className="grid h-6 w-6 place-items-center rounded-full bg-coin-500/25"><Check size={14} className="text-coin-200" /></div>}
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

function HelpSection({ onBack }) {
  return (
    <ScreenShell title="Help & Support" subtitle="How to play & get help" onBack={onBack}>
      <div className="space-y-3">
        <Card className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Sparkles size={14} className="text-coin-300" /> How to play</h3>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-slate-300">
            <li>Deposit funds via Chapa (Telebirr, CBE, Card)</li>
            <li>Pick an active game and buy a ticket</li>
            <li>Random numbers are auto-assigned</li>
            <li>Watch the live draw</li>
            <li>Win prizes when your numbers match!</li>
          </ol>
        </Card>
        <Card className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Trophy size={14} className="text-coin-300" /> Prize tiers</h3>
          <div className="mt-3 space-y-1.5 text-sm text-slate-300">
            <p><b className="text-coin-300">Match 3</b> — 2× your ticket</p>
            <p><b className="text-coin-300">Match 4</b> — 10× your ticket</p>
            <p><b className="text-coin-300">Match 5</b> — 50× your ticket</p>
            <p><b className="text-emerald-300">Match 6</b> — Jackpot!</p>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><HelpCircle size={14} className="text-coin-300" /> Need help?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Contact support on Telegram for issues with deposits, tickets, or withdrawals.</p>
        </Card>
      </div>
    </ScreenShell>
  );
}
