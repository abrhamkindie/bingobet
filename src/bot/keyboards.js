import { InlineKeyboard, Keyboard } from 'grammy';
import { formatMoney, currency, formatNumbers } from '../utils/format.js';

export function languageKeyboard(t) {
  return new InlineKeyboard()
    .text(t('language.english'), 'lang:en')
    .text(t('language.amharic'), 'lang:am');
}

export function mainKeyboard(t, isAdmin = false, miniAppUrl = '') {
  const kb = new InlineKeyboard()
    .webApp(t('menu.open_app'), miniAppUrl);

  if (isAdmin) {
    kb.row().text(t('menu.admin'), 'admin:menu');
  }

  return kb;
}

export function gamesKeyboard(t, games) {
  const kb = new InlineKeyboard();
  games.forEach((game, i) => {
    const label = `${game.title.slice(0, 20)} - ${formatMoney(game.ticket_price)} ${currency}`;
    kb.text(label, `game:view:${game.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (games.length % 2 !== 0) kb.row();
  kb.text(t('common.back'), 'start:welcome');
  return kb;
}

export function gameDetailKeyboard(t, game) {
  const kb = new InlineKeyboard();
  if (game.status === 'upcoming' || game.status === 'active') {
    kb.text(t('games.buy_button'), `ticket:buy:${game.id}`);
    kb.row();
  }
  kb.text(t('common.back'), 'games:list');
  return kb;
}

export function confirmBuyKeyboard(t, gameId) {
  return new InlineKeyboard()
    .text(t('common.confirm'), `ticket:confirm:${gameId}`)
    .row()
    .text(t('common.cancel'), 'games:list');
}

export function walletKeyboard(t) {
  return new InlineKeyboard()
    .text(t('wallet.deposit'), 'wallet:deposit')
    .text(t('wallet.withdraw'), 'wallet:withdraw')
    .row()
    .text(t('common.back'), 'start:welcome');
}

export function myTicketsKeyboard(t, tickets, page = 0) {
  const kb = new InlineKeyboard();
  tickets.slice(page * 5, (page + 1) * 5).forEach((ticket) => {
    const win = ticket.is_winner ? '🏆' : '';
    kb.text(`#${ticket.position} ${win}`, `ticket:view:${ticket.id}`);
    kb.row();
  });
  if (tickets.length > (page + 1) * 5) {
    kb.text('Next →', `tickets:page:${page + 1}`);
  }
  kb.text(t('common.back'), 'start:welcome');
  return kb;
}

export function adminMenuKeyboard(t) {
  return new InlineKeyboard()
    .text(t('admin.create_game'), 'admin:create:title')
    .row()
    .text(t('admin.manage_games'), 'admin:games:list')
    .row()
    .text(t('admin.players'), 'admin:players:list')
    .row()
    .text(t('common.back'), 'start:welcome');
}

export function adminGamesKeyboard(t, games) {
  const kb = new InlineKeyboard();
  games.forEach((game) => {
    const status = game.status === 'active' ? '🟢' : game.status === 'upcoming' ? '🟡' : '🔴';
    kb.text(`${status} ${game.title.slice(0, 15)}`, `admin:game:${game.id}`);
    kb.row();
  });
  kb.text(t('common.back'), 'admin:menu');
  return kb;
}

export function adminGameActionsKeyboard(t, game) {
  const kb = new InlineKeyboard();
  if (game.status === 'active') {
    kb.text(t('admin.draw_game'), `admin:draw:${game.id}`);
    kb.row();
  }
  kb.text(t('common.back'), 'admin:games:list');
  return kb;
}

export function drawConfirmKeyboard(t, gameId) {
  return new InlineKeyboard()
    .text('🎲 Start Draw', `admin:draw:confirm:${gameId}`)
    .row()
    .text(t('common.cancel'), `admin:game:${gameId}`);
}

export function resultsKeyboard(t, games) {
  const kb = new InlineKeyboard();
  games.slice(0, 10).forEach((game) => {
    kb.text(`${game.title.slice(0, 20)}`, `result:view:${game.id}`);
    kb.row();
  });
  kb.text(t('common.back'), 'start:welcome');
  return kb;
}

export function depositKeyboard(t) {
  return new InlineKeyboard()
    .text('100 ETB', 'wallet:deposit:100')
    .text('200 ETB', 'wallet:deposit:200')
    .text('500 ETB', 'wallet:deposit:500')
    .row()
    .text('1000 ETB', 'wallet:deposit:1000')
    .text('2000 ETB', 'wallet:deposit:2000')
    .text('5000 ETB', 'wallet:deposit:5000')
    .row()
    .text(t('common.cancel'), 'wallet:show');
}

export function withdrawKeyboard(t) {
  return new InlineKeyboard()
    .text('100 ETB', 'wallet:withdraw:100')
    .text('200 ETB', 'wallet:withdraw:200')
    .text('500 ETB', 'wallet:withdraw:500')
    .row()
    .text('1000 ETB', 'wallet:withdraw:1000')
    .text(t('common.cancel'), 'wallet:show');
}
