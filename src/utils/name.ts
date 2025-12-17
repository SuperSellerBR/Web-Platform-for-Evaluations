export function formatFullName(first?: string, last?: string) {
  const f = (first || '').trim();
  const l = (last || '').trim();
  const joined = [f, l].filter(Boolean).join(' ').trim();
  return joined || f || l;
}

export function getFirstName(name?: string) {
  const base = (name || '').trim();
  if (!base) return '';
  return base.split(/\s+/)[0];
}
