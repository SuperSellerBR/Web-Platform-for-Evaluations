export const readSearchParams = () => {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
};

export const readTrimmedStringParam = (key: string) => {
  const params = readSearchParams();
  return (params.get(key) || '').trim();
};

export const readEnumParam = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const raw = readTrimmedStringParam(key);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
};

export const readIntParam = (key: string, fallback: number, opts?: { min?: number; max?: number }) => {
  const raw = readTrimmedStringParam(key);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = opts?.min ?? Number.NEGATIVE_INFINITY;
  const max = opts?.max ?? Number.POSITIVE_INFINITY;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
};

export const readStringArrayParam = (key: string) => {
  const raw = readTrimmedStringParam(key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

export const writeQueryParamsPatch = (patch: Record<string, string | null | undefined>) => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const params = url.searchParams;

  Object.entries(patch).forEach(([key, value]) => {
    const v = (value ?? '').toString();
    if (!v) params.delete(key);
    else params.set(key, v);
  });

  const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, '', next);
  }
};

export const encodeStringArrayParam = (values: string[]) =>
  values
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(',');

