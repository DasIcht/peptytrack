import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSection } from './ThemeSection';

const mockSetTheme = vi.fn();
const mockSetCustomAccent = vi.fn();
const mockClearCustomAccent = vi.fn();

vi.mock('../stores/themeStore', () => ({
  useThemeStore: (selector: (s: object) => unknown) => selector({
    themeId: 'teal-night',
    customAccentColor: null,
    height: null,
    heightUnit: 'cm' as 'cm',
    gender: null,
    setTheme: mockSetTheme,
    setCustomAccent: mockSetCustomAccent,
    clearCustomAccent: mockClearCustomAccent,
  }),
}));

vi.mock('../lib/themeUtils', () => ({
  THEMES: [
    { id: 'teal-night',   name: 'Teal Night',   accentColor: '#14b8a6', bgColor: '#020617', isLight: false },
    { id: 'violet-storm', name: 'Violet Storm',  accentColor: '#8b5cf6', bgColor: '#0d0418', isLight: false },
    { id: 'solar-amber',  name: 'Solar Amber',   accentColor: '#f59e0b', bgColor: '#0d0d00', isLight: false },
    { id: 'arctic-blue',  name: 'Arctic Blue',   accentColor: '#0ea5e9', bgColor: '#020b18', isLight: false },
    { id: 'nordic',       name: 'Nordic',        accentColor: '#c67b5c', bgColor: '#fafbfc', isLight: true  },
    { id: 'kinetic-flux', name: 'Kinetic Flux',  accentColor: '#2bb3ff', bgColor: '#f4f6fb', isLight: true  },
    { id: 'notion',       name: 'Notion',        accentColor: '#2383e2', bgColor: '#ffffff',  isLight: true  },
  ],
}));

describe('ThemeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 7 preset theme swatches', () => {
    render(<ThemeSection />);
    const swatches = screen.getAllByRole('radio');
    // 7 presets + 1 custom = 8
    expect(swatches).toHaveLength(8);
  });

  it('renders the Appearance heading', () => {
    render(<ThemeSection />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('active theme swatch has aria-checked=true', () => {
    render(<ThemeSection />);
    const tealSwatch = screen.getByRole('radio', { name: /teal night/i });
    expect(tealSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a different swatch calls setTheme', () => {
    render(<ThemeSection />);
    const violetSwatch = screen.getByRole('radio', { name: /violet storm/i });
    fireEvent.click(violetSwatch);
    expect(mockSetTheme).toHaveBeenCalledWith('violet-storm');
  });

  it('does not show color picker when no custom accent active', () => {
    render(<ThemeSection />);
    expect(screen.queryByLabelText(/accent colour/i)).not.toBeInTheDocument();
  });

  it('shows color picker when custom swatch is selected', () => {
    render(<ThemeSection />);
    const customSwatch = screen.getByRole('radio', { name: /custom/i });
    fireEvent.click(customSwatch);
    expect(screen.getByLabelText(/accent colour/i)).toBeInTheDocument();
  });

  it('color picker change calls setCustomAccent', () => {
    render(<ThemeSection />);
    fireEvent.click(screen.getByRole('radio', { name: /custom/i }));
    const picker = screen.getByLabelText(/accent colour/i);
    fireEvent.change(picker, { target: { value: '#e11d48' } });
    expect(mockSetCustomAccent).toHaveBeenCalledWith('#e11d48');
  });
});
