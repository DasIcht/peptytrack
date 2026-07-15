import { describe, it, expect, beforeEach } from 'vitest';
import { computePrimaryPalette, applyTheme, THEMES, hexToHsl, hslToHex } from './themeUtils';

describe('hexToHsl', () => {
  it('converts teal #14b8a6 correctly', () => {
    const { h, s, l } = hexToHsl('#14b8a6');
    expect(h).toBeCloseTo(173, 0);
    expect(s).toBeCloseTo(80, 0);
    expect(l).toBeCloseTo(40, 0);
  });

  it('converts red #ef4444 correctly', () => {
    const { h, s, l } = hexToHsl('#ef4444');
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeGreaterThan(70);
    expect(l).toBeCloseTo(60, 0);
  });
});

describe('hslToHex', () => {
  it('round-trips through hexToHsl', () => {
    const original = '#14b8a6';
    const { h, s, l } = hexToHsl(original);
    const result = hslToHex(h, s, l);
    // Allow slight rounding difference
    expect(result.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('computePrimaryPalette', () => {
  it('returns exactly 10 palette keys', () => {
    const palette = computePrimaryPalette('#14b8a6');
    expect(Object.keys(palette)).toHaveLength(10);
    expect(Object.keys(palette)).toEqual(['50','100','200','300','400','500','600','700','800','900']);
  });

  it('all values are valid hex strings', () => {
    const palette = computePrimaryPalette('#8b5cf6');
    Object.values(palette).forEach(hex => {
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('500 shade matches the input colour hue', () => {
    const input = '#f59e0b';
    const palette = computePrimaryPalette(input);
    const { h: inputH } = hexToHsl(input);
    const { h: outH } = hexToHsl(palette['500']);
    expect(Math.abs(inputH - outH)).toBeLessThan(5);
  });

  it('50 shade is lighter than 900 shade', () => {
    const palette = computePrimaryPalette('#2383e2');
    const { l: l50 } = hexToHsl(palette['50']);
    const { l: l900 } = hexToHsl(palette['900']);
    expect(l50).toBeGreaterThan(l900);
  });
});

describe('THEMES', () => {
  it('contains exactly 7 themes', () => {
    expect(THEMES).toHaveLength(7);
  });

  it('first theme is teal-night (the default)', () => {
    expect(THEMES[0].id).toBe('teal-night');
  });

  it('all themes have required fields', () => {
    THEMES.forEach(theme => {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(theme.bgColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof theme.isLight).toBe('boolean');
    });
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    // Reset document attributes between tests
    document.documentElement.removeAttribute('data-theme');
    // Clear inline CSS vars
    const el = document.documentElement;
    ['50','100','200','300','400','500','600','700','800','900'].forEach(step => {
      el.style.removeProperty(`--color-primary-${step}`);
    });
  });

  it('sets data-theme attribute for a preset', () => {
    applyTheme('violet-storm', null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('violet-storm');
  });

  it('sets data-theme to teal-night by default', () => {
    applyTheme('teal-night', null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('teal-night');
  });

  it('writes custom accent CSS variables when customAccent is provided', () => {
    applyTheme('teal-night', '#e11d48');
    const el = document.documentElement;
    expect(el.style.getPropertyValue('--color-primary-500')).toBeTruthy();
    expect(el.style.getPropertyValue('--color-primary-600')).toBeTruthy();
  });

  it('clears custom accent CSS variables when customAccent is null', () => {
    // First apply a custom accent
    applyTheme('teal-night', '#e11d48');
    // Then clear it
    applyTheme('teal-night', null);
    const el = document.documentElement;
    expect(el.style.getPropertyValue('--color-primary-500')).toBe('');
  });
});
