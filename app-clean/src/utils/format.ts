import type { AppSettings } from '../context/SettingsContext';

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatDate(value: string | Date, settings: AppSettings): string {
  const d = toDate(value);
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  if (settings.dateFormat === 'MM/dd/yyyy') return `${month}/${day}/${year}`;
  return `${day}/${month}/${year}`;
}

export function formatNumber(value: number, settings: AppSettings, decimals = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  
  let sep = '.';
  if (settings.decimalSeparator === 'comma') sep = ',';
  else if (settings.decimalSeparator === 'dot' || settings.decimalSeparator === '.') sep = '.';
  else sep = settings.decimalSeparator; // Fallback

  // Add thousand separators
  const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep === ',' ? '.' : ',');

  return decPart ? `${intWithThousands}${sep}${decPart}` : intWithThousands;
}

export function formatEUR(value: number, settings: AppSettings, decimals = 2): string {
  const n = formatNumber(value, settings, decimals);
  return `${n} €`;
}
