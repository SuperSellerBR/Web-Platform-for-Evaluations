const DEFAULT_CARD_BASE_GRADIENT = 'linear-gradient(145deg, #bfc0c0 0%, #cfd1d4 45%, #f5f6f8 90%)';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const normalizeHexColor = (input?: string | null) => {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(withHash);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 6) return `#${hex.toLowerCase()}`;
  const expanded = hex
    .split('')
    .map((ch) => `${ch}${ch}`)
    .join('');
  return `#${expanded.toLowerCase()}`;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }) => {
  const toByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  const r = toByte(rgb.r).toString(16).padStart(2, '0');
  const g = toByte(rgb.g).toString(16).padStart(2, '0');
  const b = toByte(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

const mixHex = (aHex: string, bHex: string, amount: number) => {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return aHex;
  const t = clamp01(amount);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
};

const relativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const toLinear = (v: number) => {
    const srgb = v / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const liftToMinLuminance = (hex: string, minLum: number) => {
  const lum = relativeLuminance(hex);
  if (lum >= minLum) return hex;
  const t = clamp01((minLum - lum) / (1 - lum));
  return mixHex(hex, '#ffffff', t);
};

export const getCardBaseGradient = (baseColor?: string | null) => {
  const normalized = normalizeHexColor(baseColor);
  if (!normalized) return DEFAULT_CARD_BASE_GRADIENT;

  // Keep a minimum luminance so the fixed dark text stays readable, but avoid "washing out" the chosen hue.
  const base = liftToMinLuminance(normalized, 0.62);
  const stop0 = mixHex(base, '#000000', 0.05);
  const stop1 = mixHex(base, '#ffffff', 0.06);
  const stop2 = mixHex(base, '#ffffff', 0.18);
  return `linear-gradient(145deg, ${stop0} 0%, ${stop1} 45%, ${stop2} 90%)`;
};

