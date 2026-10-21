export type Period = 'ancient' | 'modern' | 'futuristic';

export const PERIODS: Period[] = ['ancient', 'modern', 'futuristic'];

export const PERIOD_LABEL: Record<Period, string> = {
  ancient: 'Ancient',
  modern: 'Modern',
  futuristic: 'Futuristic',
};

const STORAGE_KEY = 'chessarmy-period';

export function sanitizePeriod(raw: unknown): Period {
  if (raw === 'ancient' || raw === 'modern' || raw === 'futuristic') return raw;
  return 'modern';
}

export function getSelectedPeriod(): Period {
  try {
    return sanitizePeriod(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'modern';
  }
}

export function setSelectedPeriod(period: unknown): Period {
  const next = sanitizePeriod(period);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
  applyPeriodTheme(next);
  return next;
}

export function applyPeriodTheme(period: Period): void {
  document.documentElement.dataset.period = sanitizePeriod(period);
}

applyPeriodTheme(getSelectedPeriod());
