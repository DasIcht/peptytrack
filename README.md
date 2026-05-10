# PeptyTrack

> **Free · Private · Offline-first GLP-1 Medication Tracker**

PeptyTrack is a fully functional, open-source alternative to paid GLP-1 tracking apps like Shotsy. It works entirely on your device — no cloud required, no subscriptions, no data mining. Your health data stays yours.

## Features

### Core Tracking
- **Dual-Mode Quick Log / Full Log** — Quick Log for routine 3-tap logging (medication, vial, dosage, injection site). Full Log for complete entry with date/time, notes, side effects, and full vial dashboard. Mode preference persists between sessions
- **2-Column Vial Layout** — Dropdown selector on the left, selected vial summary (name + color-coded remaining) on the right. Full Log adds CircularProgress dashboard below
- **Compact Single-Row Dosage** — Small horizontal-scroll pill buttons (h-9, text-xs) that never wrap — always one line
- **2-Column Injection Site Selector** — Left column shows body zones (Abdomen, Thigh, Upper Arm), right column shows a 2×2 grid of sites for the selected zone. Both fit in half the vertical space
- **Premium Dose Logging UI** — Glass-morphism cards, gradient hero header, animated circular vial progress, expandable notes, animated side effects chips, and timeline-style dose history. Auto-calculates injection volume (ml + U-100 units) and supports automatic injection site rotation
- **Medication Level Visualization** — Real-time estimated medication concentration chart based on pharmacokinetic half-life modeling
- **Weight Tracking** — Log daily weights with trend analysis and interactive charts
- **Multiple Medications** — Track several GLP-1 drugs simultaneously with independent schedules
- **Vial Tracking** — Dedicated Vials page with medication filter (defaults to last-logged). Manage peptide vials with reconstitution details, auto-track remaining amount as doses are administered, or set a manual override. When logging a dose, the app calculates and displays the exact injection volume in both ml and insulin units (U-100 scale) based on vial concentration

### Supported Medications
| Medication | Brands | Half-Life | Frequency |
|------------|--------|-----------|-----------|
| Semaglutide | Ozempic, Wegovy, Rybelsus | 168h (7d) | Weekly |
| Tirzepatide | Mounjaro, Zepbound | 120h (5d) | Weekly |
| Liraglutide | Victoza, Saxenda | 13h | Daily |
| Dulaglutide | Trulicity | 120h (5d) | Weekly |
| Exenatide | Byetta | 2.4h | Twice daily |
| Exenatide ER | Bydureon, Bydureon BCise | 336h (14d) | Weekly |
| Lixisenatide | Adlyxin | 3h | Daily |
| Retatrutide | Zepbound | 168h (7d) | Weekly |

### Smart Features
- **Persistent Settings** — Choose default weight unit (kg/lb) and control notification master switch
- **Modal Confirmation Dialogs** — Styled, non-blocking confirmation dialogs for all destructive actions (delete dose, delete weight, delete medication, clear all data)
- **Configurable Reminders** — Set per-medication reminder hours before next dose; master on/off switch
- **PDF Reports** — Generate doctor-ready reports with medication history, dose logs, and weight trends
- **Side Effects Logging** — Tap-to-log curated GLP-1 side effects (22 clinically categorized by rarity). Smart ordering prioritizes previously-selected effects per medication. **Severity Tracking** (Mild/Moderate/Severe) with color-coded visual indicators and tactile cycling (tap to cycle severity).
- **Independent Symptom Logs** — Log symptoms independently from dose entries (e.g., between doses). Accessible via the Quick Log screen when dosage is empty.
- **Severity-Weighted Titration** — Evaluation engine uses a point-based system (Mild=1, Moderate=2, Severe=3) to recommend holding current dose if total severity score > 3 in the last 14 days.
- **Injection Site Rotation** — Auto-rotate injection sites with 3 strategies (Sequential, Quadrant, Least-Used). Pick which sites to include in rotation (min 2)
- **Data Backup/Restore** — Export/import JSON backups; auto-backup on every change with restore prompt
- **PWA Offline Support** — Install as a standalone app, works without internet
- **Edit Everything** — Modify medications, dose entries, and weight entries after logging
- **Multi-Med Chart** — View all enabled medications simultaneously with legend toggling
- **Custom Medications** — Add any medication not in the built-in library
- **Swipe Navigation** — Swipe left/right to switch between tabs on mobile
- **Titration Wizard** — Automated protocol management with dose step-up recommendations. Features a **Severe Side Effect Warning System** (configurable point threshold) with high-priority UI alerts. Medical disclaimer confirmation flow. Interactive **Titration Charts** (Spider Radar, Gauges, Timeline) for visualizing readiness parameters (Time Progress, Symptom Tolerance, Weight Stability). Automatically detects dose start dates from history logs and monitors for data gaps (drops readiness to 0% if weight or symptom logs are missing for the required period).

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** — Dark theme with teal/emerald palette
- **IndexedDB (Dexie)** — 100% local data storage
- **Zustand** — Lightweight state management
- **Recharts** — Interactive charts
- **jsPDF** — PDF report generation
- **vite-plugin-pwa** — Service worker + manifest

## Privacy

All data is stored locally in your browser's IndexedDB. No health information is ever transmitted to external servers unless you explicitly choose to back up to Google Drive or Dropbox.

## Getting Started

```bash
npm install
npm run dev     # Start dev server (http://localhost:5173)
npm run build   # Production build  → dist/
npm run test    # Run unit tests (Vitest + jsdom)
```

## Testing

The project includes unit and component tests using **Vitest** with **jsdom** environment and **@testing-library/react**.

| Suite | Tests | Focus |
|-------|-------|-------|
| `database.test.ts` | 22 | Dexie CRUD, vial storage, settings persistence, seed deduplication, customSideEffects |
| `medicationStore.test.ts` | 5 | Enable/disable toggle, custom meds, dose updates |
| `settingsStore.test.ts` | 4 | Default settings, persist/reload, getSetting |
| `halfLifeEngine.test.ts` | 15 | Concentration decay, dose accumulation, next dose timing |
| `vialStore.test.ts` | 10 | CRUD, remaining computation, filtering, last used, remaining override |
| `ConfirmDialog.test.tsx` | 7 | Rendering, confirm/cancel actions, danger styling |
| `sideEffects.test.ts` | 8 | Side effect rarity ordering, per-medication smart sorting, deduplication |
| `sideEffectsStore.test.ts` | 7 | CRUD, persistence, deduplication, per-med isolation |
| `SideEffectChips.test.tsx` | 8 | Rendering, toggle selection, custom add, expand/collapse |
| `injectionRotation.test.ts` | 12 | Sequential, quadrant, LRU strategies, activeSites subset |
| `LogDose.test.tsx` | 17 | Dual-mode Quick/Full rendering, mode toggle persistence, zone strip, site selection, form submission, dose warnings |
| `titrationAnalytics.test.ts` | 4 | Time-based step-up, severity-weighted hold, rapid weight loss detection, severe threshold warning |
| `symptomLogStore.test.ts` | 5 | CRUD, independent logging persistence, medication filtering |

**Run all tests:**
```bash
npm run test
```

## Deploy to Netlify

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

**Live URL:** https://peptytrack.netlify.app

The app is deployed on Netlify with a permanent URL. Updates are instant — just rebuild and redeploy. All user data stays in the phone's IndexedDB and survives code updates.

## Cloud Backup Setup

### Google Drive
1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials (Web application type)
4. Add your domain to authorized origins
5. Enter your Client ID in the Settings page

### Dropbox
1. Create an app at [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Choose "Scoped access"
3. Enter your App Key in the Settings page

## Disclaimer

This app is for tracking and educational purposes only. It does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider regarding your medication.

## License

MIT
