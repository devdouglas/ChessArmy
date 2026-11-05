/** Client for the Vite TTS middleware (ElevenLabs key stays server-side). */

import { isKnownCopyTag } from './copy';

export type TtsVoice = { id: string; name: string };

/** Victor - Deep, Malevolent and Ancient */
export const DEFAULT_TTS_VOICE_ID = 'cPoqAvGWCPfCfyPMwe4z';
export const DEFAULT_TTS_VOICE_NAME = 'Victor - Deep, Malevolent and Ancient';

const VOICE_KEY = 'chessarmy-tts-voice-v1';
const TTS_BASE = `${import.meta.env.BASE_URL}api/tts`;

export function loadTtsVoiceId(): string {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    if (v && /^[A-Za-z0-9]{10,64}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_TTS_VOICE_ID;
}

export function saveTtsVoiceId(id: string): void {
  try {
    localStorage.setItem(VOICE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * Drop known game glyphs (`[hoplite]`, `[rest]`, …) so they aren't spoken.
 * Keep unknown `[tags]` for ElevenLabs (e.g. `[whispers]`, `[laughs]`).
 */
export function textForTts(raw: string): string {
  return raw
    .replace(/\[([^\[\]]+)\]/g, (full, inner: string) => (isKnownCopyTag(inner) ? ' ' : full))
    .replace(/\s+/g, ' ')
    .trim();
}

/** ElevenLabs-bound tags still present after stripping game glyphs. */
export function ttsTagsUsed(raw: string): string[] {
  const tags: string[] = [];
  for (const m of raw.matchAll(/\[([^\[\]]+)\]/g)) {
    if (!isKnownCopyTag(m[1])) tags.push(`[${m[1]}]`);
  }
  return tags;
}

/** List label for a generated take, e.g. `take: [whispers] [laughs]`. */
export function ttsTakeLabel(raw: string): string {
  const tags = ttsTagsUsed(raw);
  return tags.length ? `take: ${tags.join(' ')}` : 'take:';
}

export async function listTtsVoices(): Promise<TtsVoice[]> {
  const res = await fetch(`${TTS_BASE}/voices`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; voices?: TtsVoice[]; error?: string }
    | null;
  if (!res.ok || !data?.ok || !Array.isArray(data.voices)) {
    throw new Error(data?.error || 'could not list voices');
  }
  return data.voices.filter(
    (v): v is TtsVoice =>
      !!v && typeof v.id === 'string' && typeof v.name === 'string' && !!v.id && !!v.name,
  );
}

export async function generateTts(text: string, voiceId: string): Promise<Blob> {
  const res = await fetch(`${TTS_BASE}/generate`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `generate failed (${res.status})`);
  }
  return res.blob();
}
