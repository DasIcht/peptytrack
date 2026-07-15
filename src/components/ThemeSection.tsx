import { useState } from 'react';
import { Palette } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { THEMES } from '../lib/themeUtils';
import type { ThemeId } from '../types';

export function ThemeSection() {
  const themeId = useThemeStore((s) => s.themeId);
  const customAccentColor = useThemeStore((s) => s.customAccentColor);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setCustomAccent = useThemeStore((s) => s.setCustomAccent);
  const clearCustomAccent = useThemeStore((s) => s.clearCustomAccent);

  // Local state: is the "Custom" swatch currently selected in the UI?
  const [customSelected, setCustomSelected] = useState(customAccentColor !== null);

  const handlePresetClick = (id: ThemeId) => {
    setCustomSelected(false);
    setTheme(id);
  };

  const handleCustomClick = () => {
    setCustomSelected(true);
    // If no custom colour was previously set, prime the picker with the current accent
    if (!customAccentColor) {
      const theme = THEMES.find((t) => t.id === themeId);
      if (theme) setCustomAccent(theme.accentColor);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomAccent(e.target.value);
  };

  const handleClearCustom = () => {
    setCustomSelected(false);
    clearCustomAccent();
  };

  const currentAccent = customAccentColor ?? THEMES.find((t) => t.id === themeId)?.accentColor ?? '#14b8a6';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Appearance
      </h2>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-card-bg)' }}
      >
        {/* Theme Swatches Grid */}
        <div className="p-4">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Theme
          </p>
          <div
            role="radiogroup"
            aria-label="Theme selection"
            className="grid grid-cols-4 gap-2"
          >
            {/* 7 preset swatches */}
            {THEMES.map((theme) => {
              const isActive = themeId === theme.id && !customSelected;
              return (
                <button
                  key={theme.id}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={theme.name}
                  onClick={() => handlePresetClick(theme.id)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 btn-tactile"
                  style={{
                    border: isActive
                      ? `2px solid var(--color-primary-500)`
                      : '2px solid transparent',
                    background: isActive
                      ? `color-mix(in srgb, var(--color-primary-500) 10%, transparent)`
                      : 'transparent',
                  }}
                >
                  {/* Swatch visual */}
                  <div
                    className="w-10 h-8 rounded-lg relative overflow-hidden shadow-sm"
                    style={{ background: theme.bgColor }}
                  >
                    {/* Accent dot */}
                    <div
                      className="absolute bottom-1.5 right-1.5 w-3 h-3 rounded-full"
                      style={{ background: theme.accentColor }}
                    />
                    {/* Light mode indicator */}
                    {theme.isLight && (
                      <div
                        className="absolute top-1 left-1 w-2 h-2 rounded-full opacity-60"
                        style={{ background: theme.accentColor }}
                      />
                    )}
                  </div>
                  {/* Name label */}
                  <span
                    className="text-[10px] font-medium text-center leading-tight"
                    style={{ color: isActive ? 'var(--color-primary-400)' : 'var(--color-text-muted)' }}
                  >
                    {theme.name}
                  </span>
                </button>
              );
            })}

            {/* Custom swatch */}
            <button
              role="radio"
              aria-checked={customSelected}
              aria-label="Custom"
              onClick={handleCustomClick}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 btn-tactile"
              style={{
                border: customSelected
                  ? `2px solid var(--color-primary-500)`
                  : '2px solid transparent',
                background: customSelected
                  ? `color-mix(in srgb, var(--color-primary-500) 10%, transparent)`
                  : 'transparent',
              }}
            >
              <div
                className="w-10 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: customSelected
                    ? currentAccent
                    : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)',
                }}
              >
                <Palette size={14} className="text-white drop-shadow" />
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: customSelected ? 'var(--color-primary-400)' : 'var(--color-text-muted)' }}
              >
                Custom
              </span>
            </button>
          </div>
        </div>

        {/* Custom Accent Colour Picker — shown only when Custom is selected */}
        {customSelected && (
          <div
            className="px-4 pb-4"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <div className="pt-3 flex items-center gap-3">
              <label
                htmlFor="theme-accent-picker"
                className="text-xs font-medium shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Accent colour
              </label>
              <div className="flex-1 flex items-center gap-2">
                {/* Colour preview swatch */}
                <div
                  className="w-7 h-7 rounded-lg border shrink-0"
                  style={{
                    background: currentAccent,
                    borderColor: 'var(--color-border)',
                  }}
                />
                {/* Hex value display */}
                <span
                  className="text-xs font-mono"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {currentAccent}
                </span>
                {/* Native colour input */}
                <input
                  id="theme-accent-picker"
                  type="color"
                  aria-label="Accent colour"
                  value={currentAccent}
                  onChange={handleColorChange}
                  className="ml-auto w-10 h-8 rounded cursor-pointer border-0 p-0"
                  style={{ background: 'transparent' }}
                />
              </div>
            </div>
            {/* Reset button */}
            <button
              onClick={handleClearCustom}
              className="mt-2 text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Reset to preset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
