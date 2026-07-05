import React, { useState, useEffect, useContext, useCallback } from 'react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import {
  User, Wallet, CreditCard, Trophy, Languages, HelpCircle, Shield,
  ChevronRight, ArrowLeft, Check, AlertCircle,
  ShoppingBag, Gem, Sparkles, History, Plus, RefreshCw
} from 'lucide-react';

export default function ProfileScreen() {
  const { player, reload } = useContext(PlayerContext);
  const [section, setSection] = useState(null);

  return (
    <div className="profile-orbit min-h-full px-4 pb-5 pt-4">
      {section === null && <ProfileHeader player={player} />}
      {section === null && <WalletCard player={player} />}
      {section === null && <MenuList player={player} setSection={setSection} />}
      {section === 'transactions' && <TransactionsSection onBack={() => setSection(null)} />}
      {section === 'language' && <LanguageSection onBack={() => setSection(null)} player={player} reload={reload} />}
      {section === 'help' && <HelpSection onBack={() => setSection(null)} />}
    </div>
  );
}

function ProfileHeader({ player }) {
  const initials = (player?.name || player?.username || 'B').slice(0, 1).toUpperCase();
  const { addToast } = useContext(ToastContext);

  // Quick deposit handler
  const handleQuickDeposit = async () => {
    try {
      const result = await api.deposit(100);
      if (result?.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank');
      } else {
        addToast('Deposit initiated!', 'success');
      }
    } catch {
      addToast('Deposit failed. Try again.', 'error');
    }
  };

  return (
    <div className="relative mb-5 animate-fade-in-up overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
          <span className="text-xl font-black text-white" style={{ textShadow: '0 0 12px rgba(103,232,249,0.4)' }}>{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white">{player?.name || 'Player'}</h1>
          <p className="text-sm text-slate-400">{player?.username ? `@${player.username}` : `ID: ${player?.id || '-'}`}</p>
          {player?.role === 'admin' ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
              <Shield size={10} /> Admin
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              <User size={10} /> Player
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function WalletCard({ player }) {
  const { addToast } = useContext(ToastContext);
  const [depositing, setDepositing] = useState(false);

  const handleDeposit = async () => {
    setDepositing(true);
    try {
      const result = await api.deposit(100);
      if (result?.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank');
      }
      addToast('Opening payment page...', 'info');
    } catch {
      addToast('Deposit failed. Try again.', 'error');
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="relative mb-4 animate-fade-in-up overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur" style={{ animationDelay: '0.1s' }}>
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="flex items-center justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Wallet size={12} /> Wallet Balance
          </p>
          <p className="mt-1 text-2xl font-black text-white animate-count-up">
            {Number(player?.wallet_balance || 0).toLocaleString()}{' '}
            <span className="text-sm font-bold text-cyan-300">ETB</span>
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-400/10 shadow-[0_0_14px_rgba(34,211,238,0.1)]">
          <Gem size={22} className="text-cyan-300" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex gap-2">
        <button onClick={handleDeposit} disabled={depositing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-2.5 text-xs font-bold text-white shadow-[0_0_10px_rgba(34,211,238,0.15)] transition-all hover:from-cyan-500 hover:to-cyan-400 active:scale-95 disabled:opacity-60">
          {depositing ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          {depositing ? 'Opening...' : 'Deposit'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center backdrop-blur">
          <p className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-400"><ShoppingBag size={10} /> Spent</p>
          <p className="text-sm font-bold text-white">{Number(player?.total_spent || 0).toLocaleString()} ETB</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center backdrop-blur">
          <p className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-400"><Trophy size={10} /> Won</p>
          <p className="text-sm font-bold text-emerald-300">{Number(player?.total_won || 0).toLocaleString()} ETB</p>
        </div>
      </div>
    </div>
  );
}

function MenuList({ player, setSection }) {
  const items = [
    ...(player?.role === 'admin' ? [{
      key: 'admin', label: 'Admin Panel', Icon: Shield,
      desc: 'Game management and reporting',
      action: () => window.open('/admin', '_blank'),
    }] : []),
    { key: 'transactions', label: 'Transactions', Icon: History,
      desc: 'Deposit, withdrawal & game history' },
    { key: 'language', label: 'Language', Icon: Languages,
      desc: player?.language_pref === 'am' ? 'አማርኛ' : 'English' },
    { key: 'help', label: 'Help & Support', Icon: HelpCircle,
      desc: 'Guides and account support' },
  ];

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <button key={item.key} onClick={() => (item.action ? item.action() : setSection(item.key))}
          className="group flex w-full animate-slide-up items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left backdrop-blur transition-all duration-200 hover:border-cyan-300/15 hover:bg-white/[0.07] active:scale-[0.99]"
          style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur transition-colors group-hover:border-cyan-300/15 group-hover:bg-cyan-400/10">
            <item.Icon size={18} className="text-cyan-300/70 group-hover:text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{item.label}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{item.desc}</p>
          </div>
          <ChevronRight size={16} className="text-slate-500 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}

function TransactionsSection({ onBack }) {
  const { addToast } = useContext(ToastContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getTransactions();
      setTransactions(data.transactions || []);
    } catch {
      setError('Failed to load transactions');
      addToast('Could not load transactions', 'error');
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionFrame title="Transactions" subtitle="Deposits, purchases, and winnings" onBack={onBack}>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/[0.08]" />
              <div className="flex-1"><div className="h-4 w-2/3 rounded bg-white/[0.08]" /><div className="mt-2 h-3 w-1/2 rounded bg-white/[0.05]" /></div>
            </div>
          </div>
        ))}</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center backdrop-blur">
          <AlertCircle size={28} className="mx-auto mb-2 text-red-300" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={load} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 active:scale-95">Try Again</button>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState Icon={History} title="No transactions yet" text="Deposit funds and buy tickets to see your transaction history." />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx, i) => {
            const isCredit = tx.type === 'deposit' || tx.type === 'winnings';
            const IconComp = tx.type === 'deposit' ? CreditCard : tx.type === 'winnings' ? Trophy : ShoppingBag;
            const iconColor = tx.type === 'winnings' ? 'text-emerald-300' : tx.type === 'deposit' ? 'text-cyan-300' : 'text-slate-400';
            return (
              <div key={tx.id} className="animate-slide-up flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur transition-all hover:border-white/20" style={{ animationDelay: `${i * 40}ms` }}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${iconColor}`}><IconComp size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize text-white">{tx.type?.replace(/_/g, ' ') || 'Transaction'}</p>
                    <span className={`text-sm font-bold ${isCredit ? 'text-emerald-300' : 'text-red-400'}`}>{isCredit ? '+' : '-'}{Number(tx.amount).toLocaleString()} ETB</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{tx.game_title || tx.reference || tx.type} &middot; {new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionFrame>
  );
}

function LanguageSection({ onBack, player, reload }) {
  const { addToast } = useContext(ToastContext);
  const current = player?.language_pref || 'en';
  const languages = [
    { key: 'en', label: 'English', desc: 'English interface' },
    { key: 'am', label: 'አማርኛ', desc: 'Amharic interface' },
  ];

  const handleChange = async (lang) => {
    try {
      await api.setLanguage(lang);
      addToast(lang === 'am' ? 'ቋንቋ ተቀየረ' : 'Language changed', 'success');
      reload();
    } catch { addToast('Failed to change language', 'error'); }
  };

  return (
    <SectionFrame title="Language" subtitle="Choose the language used in the mini app" onBack={onBack}>
      <div className="space-y-3">
        {languages.map((lang) => (
          <button key={lang.key} onClick={() => handleChange(lang.key)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left backdrop-blur transition-all duration-200 ${
              current === lang.key
                ? 'border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_16px_rgba(34,211,238,0.1)]'
                : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.99]'
            }`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              current === lang.key ? 'border border-cyan-300/20 bg-cyan-400/15 text-cyan-200' : 'border border-white/10 bg-white/5 text-slate-400'
            }`}><Languages size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{lang.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{lang.desc}</p>
            </div>
            {current === lang.key && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20"><Check size={14} className="text-cyan-300" /></div>
            )}
          </button>
        ))}
      </div>
    </SectionFrame>
  );
}

function HelpSection({ onBack }) {
  return (
    <SectionFrame title="Help & Support" subtitle="How to play and get help" onBack={onBack}>
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Sparkles size={14} className="text-cyan-300" /> How to Play BetBingo</h3>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-slate-300">
            <li>Deposit funds into your wallet via Chapa</li>
            <li>Browse active lottery games and choose one</li>
            <li>Buy a ticket — random numbers are auto-assigned</li>
            <li>Wait for the scheduled draw</li>
            <li>Win prizes if your numbers match the drawn ones!</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Trophy size={14} className="text-cyan-300" /> Prize Tiers</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p><span className="font-bold text-cyan-300">Match 3</span> — 2x your ticket price</p>
            <p><span className="font-bold text-cyan-300">Match 4</span> — 10x your ticket price</p>
            <p><span className="font-bold text-cyan-300">Match 5</span> — 50x your ticket price</p>
            <p><span className="font-bold text-emerald-300">Match 6 (Jackpot)</span> — Win the jackpot!</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><HelpCircle size={14} className="text-cyan-300" /> Need Help?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Contact the support team via Telegram for any issues with deposits, tickets, or withdrawals.</p>
        </div>
      </div>
    </SectionFrame>
  );
}

function SectionFrame({ title, subtitle, onBack, children }) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur transition-all hover:border-white/20 hover:bg-white/10 active:scale-95">
          <ArrowLeft size={16} className="text-white" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center backdrop-blur">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Icon size={20} className="text-slate-400" /></div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
