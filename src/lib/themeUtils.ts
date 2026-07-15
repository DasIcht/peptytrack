import type { ThemeId } from '../types';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  accentColor: string;  // The primary-500 colour for swatch display
  bgColor: string;      // The surface-950 colour for swatch background
  isLight: boolean;
}

export const THEMES: ThemeDefinition[] = [
  { id: 'teal-night',    name: 'Teal Night',    accentColor: '#14b8a6', bgColor: '#020617', isLight: false },
  { id: 'violet-storm',  name: 'Violet Storm',  accentColor: '#8b5cf6', bgColor: '#0d0418', isLight: false },
  { id: 'solar-amber',   name: 'Solar Amber',   accentColor: '#f59e0b', bgColor: '#0d0d00', isLight: false },
  { id: 'arctic-blue',   name: 'Arctic Blue',   accentColor: '#0ea5e9', bgColor: '#020b18', isLight: false },
  { id: 'nordic',        name: 'Nordic',        accentColor: '#c67b5c', bgColor: '#fafbfc', isLight: true  },
  { id: 'kinetic-flux',  name: 'Kinetic Flux',  accentColor: '#2bb3ff', bgColor: '#f4f6fb', isLight: true  },
  { id: 'notion',        name: 'Notion',        accentColor: '#2383e2', bgColor: '#ffffff',  isLight: true  },
];

/** Convert a hex colour to HSL components (h: 0-360, s: 0-100, l: 0-100). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Convert HSL components to a hex colour string. */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1/6) return p + (q - p) * 6 * tc;
    if (tc < 1/2) return q;
    if (tc < 2/3) return p + (q - p) * (2/3 - tc) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1/3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1/3);
  }

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a 10-step primary colour palette from a single hex input.
 * Returns an object with keys '50', '100', '200', ..., '900'.
 */
export function computePrimaryPalette(hex: string): Record<string, string> {
  const { h, s } = hexToHsl(hex);

  // Lightness values for each shade step
  const steps: [string, number][] = [
    ['50',  97],
    ['100', 94],
    ['200', 88],
    ['300', 78],
    ['400', 65],
    ['500', 50],  // closest to input
    ['600', 42],
    ['700', 34],
    ['800', 26],
    ['900', 18],
  ];

  const palette: Record<string, string> = {};
  for (const [key, lightness] of steps) {
    // Scale saturation slightly — light shades are less saturated, dark more so
    const scaledS = key === '50' || key === '100'
      ? Math.max(20, s - 15)
      : key === '900' || key === '800'
      ? Math.min(100, s + 5)
      : s;
    palette[key] = hslToHex(h, scaledS, lightness);
  }

  return palette;
}

const PRIMARY_PALETTE_KEYS = ['50','100','200','300','400','500','600','700','800','900'];

/**
 * Apply a theme to the document.
 * Sets the data-theme attribute on <html> and optionally writes
 * custom primary palette CSS variables for the custom accent colour.
 */
export function applyTheme(themeId: ThemeId, customAccentColor: string | null): void {
  const el = document.documentElement;

  // 1. Set the data-theme attribute (drives all CSS [data-theme] blocks)
  el.setAttribute('data-theme', themeId);

  if (customAccentColor) {
    // 2a. Write custom primary palette as inline CSS variables
    //     These override the [data-theme] block variables
    const palette = computePrimaryPalette(customAccentColor);
    for (const key of PRIMARY_PALETTE_KEYS) {
      el.style.setProperty(`--color-primary-${key}`, palette[key]);
    }
  } else {
    // 2b. Clear any previously set inline custom variables
    for (const key of PRIMARY_PALETTE_KEYS) {
      el.style.removeProperty(`--color-primary-${key}`);
    }
  }
}
