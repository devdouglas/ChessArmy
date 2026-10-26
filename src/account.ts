import { listLevels } from './levels';
import {
  applyStars,
  clearBrowserProgress,
  mergeStarMaps,
  setProgressRemote,
  snapshotStars,
  starMapsEqual,
  sanitizeStarMap,
  type StarMap,
} from './progress';

export type AccountStatus = 'checking' | 'guest' | 'signed-in' | 'err';

export type AccountUser = {
  name: string;
  profileUrl: string;
  logoutUrl: string;
};

type SessionPayload = {
  loggedIn?: boolean;
  admin?: boolean;
  ajaxNonce?: string;
  loginUrl?: string | null;
  registerUrl?: string | null;
  profileUrl?: string;
  logoutUrl?: string;
  user?: { name?: string };
  progress?: { stars?: unknown };
};

let status: AccountStatus = 'checking';
let user: AccountUser | null = null;
let admin = false;
let loginUrl: string | null = null;
let registerUrl: string | null = null;
let ajaxNonce = '';
let timer = 0;
const listeners = new Set<(s: AccountStatus) => void>();

export function getAccountStatus(): AccountStatus {
  return status;
}

export function getAccountUser(): AccountUser | null {
  return user;
}

export function isAccountAdmin(): boolean {
  return admin;
}

/** WP `manage_options`, or `?admin=1` for local playtests. `?player=1` forces the lock. */
export function isEraAdmin(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('player') === '1') return false;
    if (q.get('admin') === '1') return true;
  } catch {
    /* ignore */
  }
  return admin;
}

export function getAccountLoginUrl(): string | null {
  return loginUrl;
}

export function getAccountRegisterUrl(): string | null {
  return registerUrl;
}

export function onAccountStatus(fn: (s: AccountStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(next: AccountStatus): void {
  status = next;
  for (const fn of listeners) fn(next);
}

function ajaxUrl(): string {
  return `${window.location.origin}/wp-admin/admin-ajax.php`;
}

function labelsFor(stars: StarMap): Record<string, string> {
  const names = new Map(listLevels().map((l) => [l.id, l.name]));
  const out: Record<string, string> = {};
  for (const id of Object.keys(stars)) {
    const name = names.get(id);
    if (name) out[id] = name;
  }
  return out;
}

function asGuest(session: SessionPayload | null): void {
  user = null;
  admin = false;
  ajaxNonce = '';
  setProgressRemote(false);
  loginUrl = session && typeof session.loginUrl === 'string' ? session.loginUrl : null;
  registerUrl =
    session && typeof session.registerUrl === 'string' ? session.registerUrl : null;
  setStatus('guest');
}

async function pullSession(): Promise<SessionPayload | null> {
  try {
    const res = await fetch(`${ajaxUrl()}?action=chessarmy_session`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== 'object') return null;
    return data as SessionPayload;
  } catch {
    return null;
  }
}

function saveBody(stars: StarMap): FormData {
  const fd = new FormData();
  fd.append('action', 'chessarmy_save_progress');
  fd.append('nonce', ajaxNonce);
  fd.append('stars', JSON.stringify(stars));
  fd.append('labels', JSON.stringify(labelsFor(stars)));
  return fd;
}

export async function pushAccountProgress(): Promise<boolean> {
  if (status !== 'signed-in' && status !== 'err') return false;
  if (!ajaxNonce) return false;
  try {
    const res = await fetch(ajaxUrl(), {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      body: saveBody(snapshotStars()),
    });
    if (!res.ok) {
      setStatus('err');
      return false;
    }
    const data = (await res.json()) as { ok?: boolean };
    if (!data?.ok) {
      setStatus('err');
      return false;
    }
    setStatus('signed-in');
    return true;
  } catch {
    setStatus('err');
    return false;
  }
}

function queuePush(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void pushAccountProgress();
  }, 450);
}

export async function flushAccountProgress(): Promise<boolean> {
  window.clearTimeout(timer);
  timer = 0;
  return pushAccountProgress();
}

function flushBeacon(): void {
  window.clearTimeout(timer);
  timer = 0;
  if (status !== 'signed-in' && status !== 'err') return;
  if (!ajaxNonce) return;
  const body = saveBody(snapshotStars());
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ajaxUrl(), body);
    return;
  }
  void pushAccountProgress();
}

/** Pull profile progress if signed in. Merge browser stars up, then drop the local copy. */
export async function syncAccountProgress(): Promise<{ applied: boolean }> {
  const session = await pullSession();
  if (!session?.loggedIn) {
    asGuest(session);
    return { applied: false };
  }
  const name = session.user?.name;
  if (typeof session.ajaxNonce !== 'string' || !session.ajaxNonce || typeof name !== 'string') {
    asGuest(null);
    return { applied: false };
  }
  ajaxNonce = session.ajaxNonce;
  admin = session.admin === true;
  loginUrl = null;
  registerUrl = null;
  user = {
    name,
    profileUrl: typeof session.profileUrl === 'string' ? session.profileUrl : '',
    logoutUrl: typeof session.logoutUrl === 'string' ? session.logoutUrl : '',
  };

  const local = snapshotStars();
  const remote = sanitizeStarMap(session.progress?.stars);
  const merged = mergeStarMaps(local, remote);
  applyStars(merged);
  setProgressRemote(true, queuePush);
  clearBrowserProgress();
  setStatus('signed-in');

  if (!starMapsEqual(merged, remote)) {
    const ok = await pushAccountProgress();
    if (!ok) setStatus('err');
  }
  return { applied: !starMapsEqual(merged, local) };
}

window.addEventListener('pagehide', flushBeacon);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushBeacon();
});
