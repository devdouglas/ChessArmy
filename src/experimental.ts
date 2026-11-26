/**
 * Experimental rule toggles. Off-by-default candidates live here until they graduate
 * into the normal rules. Each one can be overridden per browser through localStorage
 * (`'1'` on, `'0'` off) so playtesters can flip it without a rebuild.
 */

/**
 * General grants inspiration (passive). A General always inspires the friendly
 * units it touches — no action needed — and it propagates like the Inspire ability.
 * Default ON while this is being playtested.
 */
export const EXPERIMENTAL_GENERAL_INSPIRES_DEFAULT = true;
export const EXPERIMENTAL_GENERAL_INSPIRES_KEY = 'chessarmy-exp-general-inspires';

let generalInspiresOverride: boolean | null = null;

/** Tests / tools: force the flag (null = back to localStorage / default). */
export function setGeneralInspiresEnabled(on: boolean | null): void {
  generalInspiresOverride = on;
}

export function generalInspiresEnabled(): boolean {
  if (generalInspiresOverride !== null) return generalInspiresOverride;
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(EXPERIMENTAL_GENERAL_INSPIRES_KEY);
      if (v === '1') return true;
      if (v === '0') return false;
    }
  } catch {
    /* private mode / no storage */
  }
  return EXPERIMENTAL_GENERAL_INSPIRES_DEFAULT;
}
