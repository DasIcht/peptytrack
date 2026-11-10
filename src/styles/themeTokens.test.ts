import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
// @ts-expect-error -- plain JS config file without type declarations
import tailwindConfig from '../../tailwind.config.js';
import css from './global.css?raw';

/**
 * Compile a handful of class names through the real Tailwind config and return the CSS.
 * Guards against theme tokens that silently generate nothing (which leaves text,
 * borders and backgrounds falling back to browser defaults).
 */
async function compile(classes: string[]): Promise<string> {
  const result = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [{ raw: `<div class="${classes.join(' ')}"></div>`, extension: 'html' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const escape = (cls: string) => cls.replace(/\//g, '\\/');

describe('Tailwind theme tokens', () => {
  it.each([
    'text-content-primary',
    'text-content-secondary',
    'text-content-muted',
  ])('generates the %s text-hierarchy utility', async (cls) => {
    const css = await compile([cls]);
    expect(css).toContain(`.${cls}`);
    expect(css).toMatch(/var\(--color-text-(primary|secondary|muted)\)/);
  });

  it.each([
    'bg-primary-500/20',
    'border-primary-500/30',
    'bg-surface-900/90',
    'bg-surface-800/50',
    'text-accent-400/80',
    'border-border/50',
  ])('honours the opacity modifier on %s', async (cls) => {
    const css = await compile([cls]);
    expect(css).toContain(`.${escape(cls)}`);
    expect(css).toContain('color-mix(in srgb');
  });

  it.each(['bg-surface-700', 'hover:bg-surface-600'])('generates %s', async (cls) => {
    const css = await compile([cls]);
    expect(css).toMatch(/var\(--color-surface-(700|600)\)/);
  });
});

describe('global.css theme variables', () => {
  it('defines the derived surface-700 / surface-600 shades for every theme', () => {
    expect(css).toMatch(/\[data-theme\]\s*\{[^}]*--color-surface-700:[^}]*--color-surface-600:/);
  });

  it('remaps pale dark-theme text and white hairlines on every light theme', () => {
    for (const theme of ['nordic', 'kinetic-flux', 'notion']) {
      expect(css).toContain(`[data-theme="${theme}"]`);
    }
    const light = ':is([data-theme="nordic"], [data-theme="kinetic-flux"], [data-theme="notion"])';
    for (const cls of ['.border-white\\/10', '.bg-white\\/5', '.text-amber-200', '.text-red-300', '.text-primary-300', '.text-slate-500']) {
      expect(css).toContain(`${light} ${cls}`);
    }
  });
});
