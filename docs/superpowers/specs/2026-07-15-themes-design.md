# Theme System Design Spec — PeptiTrack

**Date:** 2026-07-15
**Status:** Approved

---

## Overview

PeptiTrack currently ships with a single hard-coded dark teal theme. This spec describes adding a full theme system with 7 built-in presets (including 3 light themes), a custom accent colour picker, and persistence through the existing settings/backup infrastructure.

---

## Goals

- 7 named theme presets selectable by the user
- Single-accent custom colour override (user picks one colour; surfaces adapt automatically)
- Theme selection lives in the existing Settings page under a new "Appearance" section
- Theme preference persists in IndexedDB and travels with backup/restore exports
- Teal Night remains the default — existing UI is completely unchanged at first launch

---

## Non-Goals

- No new navigation item or dedicated page
- No multi-colour custom palette editor (just one accent picker)
- No per-page theme overrides
- No system-preference dark/light auto-detect (user controls theme explicitly)

---

## Architecture

### Mechanism: `data-theme` + CSS Custom Properties

The entire colour system is driven by CSS custom properties defined on the `<html>` element via a `data-theme` attribute. Tailwind's `tailwind.config.js` is updated so `primary-*` and `surface-*` colours reference `var(--color-primary-*)` and `var(--color-surface-*)` instead of hardcoded hex values.

This means **all existing Tailwind classes (`bg-primary-600`, `text-surface-950`, etc.) continue to work unchanged** — they simply read their values from CSS variables, which change when the theme changes.

```
document.documentElement.setAttribute('data-theme', 'teal-night')
    -> CSS: [data-theme="teal-night"] { --color-primary-500: #14b8a6; ... }
    -> Tailwind: primary-500 = var(--color-primary-500)
    -> Component: className="bg-primary-600" picks up correct color automatically
```

### Custom Accent Override

When the user picks a custom accent colour (hex), the app computes a 9-step palette (50-900) from that single hex using HSL lightness stepping, then writes each step as an inline CSS property directly on `document.documentElement`. This overrides the `data-theme` variable for `--color-primary-*` only.

Selecting any named preset clears all inline `--color-primary-*` overrides, restoring the theme defaults.

### Light Theme Support

Themes 5-7 (Nordic, Kinetic Flux, Notion) are light-mode. CSS utility classes in `global.css` that have dark-only assumptions (`.glass`, `.card-premium`, `.input-premium`, `.mode-toggle`, etc.) are given light-mode variants triggered by their `[data-theme="..."]` selectors. The `color-scheme` property on `<html>` is also updated so native inputs render correctly.

---

## The 7 Themes

| ID | Name | Background | Accent | Mode |
|----|------|-----------|--------|------|
| `teal-night` | Teal Night (default) | #020617 | #14b8a6 teal | Dark |
| `violet-storm` | Violet Storm | #0d0418 | #8b5cf6 violet | Dark |
| `solar-amber` | Solar Amber | #0d0d00 | #f59e0b amber | Dark |
| `arctic-blue` | Arctic Blue | #020b18 | #38bdf8 sky | Dark |
| `nordic` | Nordic | #FAFBFC | #C67B5C terracotta | Light |
| `kinetic-flux` | Kinetic Flux | #f4f6fb | #2bb3ff cyan | Light |
| `notion` | Notion | #ffffff | #2383E2 blue | Light |

---

## New Files

### `src/lib/themeUtils.ts`
Pure utilities (no React/Zustand):
- `computePrimaryPalette(hex: string): Record<string, string>` — 9-step palette via HSL lightness stepping
- `applyTheme(themeId: ThemeId, customAccent: string | null): void` — sets data-theme + optional CSS var overrides
- `THEMES: ThemeDefinition[]` — metadata array for all 7 themes

### `src/stores/themeStore.ts`
Zustand store delegating persistence to settingsStore:
- State: `{ themeId: ThemeId, customAccentColor: string | null }`
- Actions: `setTheme()`, `setCustomAccent()`, `clearCustomAccent()`, `initTheme()`

### `src/components/ThemeSection.tsx`
Appearance UI at top of Settings.tsx:
- 7 preset swatches + 1 "Custom" swatch in a responsive grid
- Active swatch has ring border in current accent colour
- Custom swatch reveals native `<input type="color">` picker

---

## Modified Files

### `src/types.ts`
- Add `ThemeId` union type
- Extend `AppSettings` with `theme?: ThemeId` and `customAccentColor?: string | null`

### `tailwind.config.js`
- Replace hardcoded hex in `primary` and `surface` scales with `var(--color-primary-*)` and `var(--color-surface-*)` references

### `src/styles/global.css`
- Add `[data-theme="..."]` blocks for all 7 themes defining CSS custom properties
- Add light-mode overrides for utility classes under light theme selectors
- Replace hardcoded colour literals in utilities with CSS variable references

### `src/stores/settingsStore.ts`
- Add `theme: 'teal-night'` and `customAccentColor: null` to DEFAULT_SETTINGS

### `src/App.tsx`
- Call `themeStore.initTheme()` after `loadSettings()` completes on startup

### `src/pages/Settings.tsx`
- Render `<ThemeSection />` at top of page, above existing Preferences section

---

## CSS Variable Schema

Each theme defines:
- `--color-primary-50` through `--color-primary-900`
- `--color-surface-800`, `--color-surface-900`, `--color-surface-950`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--color-border`, `--color-card-bg`, `--color-input-bg`
- `--color-scheme` (dark or light for native inputs)

---

## Custom Accent Palette Generation

Given a single hex input, convert to HSL then generate 9 steps by varying lightness:
- 50: L=97%, 100: L=94%, 200: L=88%, 300: L=78%, 400: L=65%
- 500: user input colour
- 600: L=45%, 700: L=36%, 800: L=28%, 900: L=20%

---

## ThemeSection UI

- Swatches: 80x64px cards showing theme BG gradient + accent circle + name label
- Active: 2px ring in current --color-primary-500
- Custom swatch: palette icon + "Custom" label, reveals color picker when selected
- Color picker: displays current hex, full-width native input[type=color]
- Theme switch is instant (no loading state)

---

## Persistence

- `themeStore.setTheme()` calls `settingsStore.updateSetting('theme', id)` -> IndexedDB
- `themeStore.setCustomAccent()` calls `settingsStore.updateSetting('customAccentColor', hex)`
- `App.tsx initTheme()` reads from settingsStore, calls `applyTheme()` from themeUtils
- Backup export/import: theme fields travel with AppSettings automatically

---

## Testing

### `src/lib/themeUtils.test.ts`
- computePrimaryPalette produces 9 keys with valid hex values
- applyTheme sets data-theme attribute correctly (jsdom)
- applyTheme with custom accent writes CSS variables to documentElement

### `src/stores/themeStore.test.ts`
- setTheme updates state and calls settingsStore.updateSetting
- setCustomAccent updates state correctly
- clearCustomAccent resets to null

### `src/components/ThemeSection.test.tsx`
- Renders 7 presets + 1 custom swatch
- Active theme swatch has correct state
- Clicking swatch calls themeStore.setTheme
- Custom swatch click reveals color picker
- Color picker change calls themeStore.setCustomAccent
