let hook: (() => void) | null = null;
let silenced = 0;

export function setPersistHook(fn: (() => void) | null): void {
  hook = fn;
}

export function silencePersist<T>(fn: () => T): T {
  silenced += 1;
  try {
    return fn();
  } finally {
    silenced -= 1;
  }
}

export function notifyPersist(): void {
  if (silenced) return;
  hook?.();
}
