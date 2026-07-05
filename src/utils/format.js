import { config } from '../config/index.js';

export function formatDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatMoney(amount) {
  const n = Number(amount);
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return s;
}

export const currency = config.business.currency;

export function mdEscape(text = '') {
  return String(text).replace(/([_*`\\[\]])/g, '\\$1');
}

export function formatNumbers(numbers) {
  if (!numbers || !Array.isArray(numbers)) return '';
  return numbers.map(n => String(n).padStart(2, '0')).join(', ');
}

export function formatDrawTime(drawTime) {
  if (!drawTime) return 'Manual';
  return formatDateTime(drawTime);
}
