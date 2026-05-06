# PeptyTrack — Agent Evolution Guide

> **Purpose:** This document enables AI agents to understand, navigate, and evolve the PeptyTrack codebase safely and effectively. Read this before making any changes.

---

## 1. Project Identity

**PeptyTrack** is a privacy-first, offline-capable Progressive Web App (PWA) for tracking GLP-1 medication dosing, estimating blood concentration via pharmacokinetic half-life modeling, logging weight history, and generating doctor-ready reports.

**Live URL:** https://peptytrack.netlify.app  
**License:** MIT  
**Data Promise:** 100% on-device. No health data leaves the device unless the user explicitly triggers a cloud backup.

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Framework | React | ^19.2.5 | UI rendering |
| Language | TypeScript | ~6.0.2 | Type safety |
| Build Tool | Vite | ^8.0.10 | Dev server, bundling, HMR |
| Styling | Tailwind CSS | ^3.4.19 | Utility-first dark-themed CSS |
| PWA | `vite-plugin-pwa` | ^1.2.0 | Service worker, manifest, offline precaching |
| State | Zustand | ^5.0.12 | Lightweight global state |
| Database | Dexie | ^4.4.2 | IndexedDB wrapper |
| Charts | Recharts | ^3.8.1 | Medication level & weight visualizations |
| Dates | date-fns | ^4.1.0 | Date formatting & manipulation |
| PDF | jsPDF + jspdf-autotable | ^4.2.1 / ^5.0.7 | Doctor report generation |
| Icons | Lucide React | ^1.14.0 | Iconography |
| Testing | Vitest + jsdom + fake-indexeddb | ^4.1.5 | Unit testing with IndexedDB mock |

**Unused dependencies to be aware of:** `react-router-dom` is listed in `package.json` but the app uses a custom page router in `App.tsx`, not React Router.

---

## 3. Project Structure

```
peptyTrack/
├── public/                    # Static PWA assets (icons, favicon)
├── src/
│   ├── App.tsx                # Root: page router, init sequence, reminder polling, auto-backup
│   ├── main.tsx               # React DOM mount point
│   ├── types.ts               # Shared TypeScript interfaces (source of truth)
│   ├── styles/
│   │   └── global.css         # Tailwind directives + custom utilities + theme colors
│   ├── db/
│   │   ├── database.ts        # Dexie schema, CRUD helpers, seeding with deduplication guard
│   │   ├── database.test.ts   # DB unit tests
│   │   └── seed.ts            # Pre-populated GLP-1 medication library (8 drugs)
│   ├── stores/                # Zustand global state — ONE STORE PER DOMAIN
│   │   ├── medicationStore.ts # Medications + doses + computed getters
│   │   ├── medicationStore.test.ts
│   │   ├── weightStore.ts     # Weight entries + trend calculations
│   │   ├── uiStore.ts         # Page nav, modals, toast queue, log-dose preselection
│   │   ├── settingsStore.ts   # App preferences (weight unit, notification master switch)
│   │   ├── settingsStore.test.ts
│   │   ├── vialStore.ts       # Vial CRUD + computed remaining tracking
│   │   └── vialStore.test.ts
│   ├── lib/                   # Core business logic — PURE FUNCTIONS preferred
│   │   ├── halfLifeEngine.ts      # Pharmacokinetic accumulation model
│   │   ├── halfLifeEngine.test.ts # 15 unit tests
│   │   ├── notifications.ts       # Browser notification permission + scheduling
│   │   ├── pdfExport.ts           # PDF report generation
│   │   ├── cloudSync.ts           # Google Drive / Dropbox OAuth scaffolding
│   │   └── autoBackup.ts          # localStorage auto-backup helpers
│   ├── components/            # Reusable UI components
│   │   ├── BottomNav.tsx      # Fixed bottom tab bar (6 tabs)
│   │   ├── MedicationCard.tsx # Dashboard card with level gauge + countdown
│   │   ├── Modal.tsx          # Generic modal wrapper (rendered by App.tsx)
│   │   ├── ConfirmDialog.tsx  # Styled confirmation dialog for destructive actions
│   │   ├── ConfirmDialog.test.tsx
│   │   └── Toast.tsx          # Toast notification system
│   └── pages/                 # Full-page route components
│       ├── Dashboard.tsx      # Home: stats, medication cards, quick actions
│       ├── LogDose.tsx        # Dose logging with injection site picker, vial selection, auto-calculated injection volume (ml + U-100 units)
│       ├── MedicationChart.tsx# Dual-axis medication level + weight chart
│       ├── WeightTracker.tsx  # Weight logging with date picker + history
│       ├── Medications.tsx    # Medication management — add from library/custom, enable/disable
│       ├── Vials.tsx          # Vial management grouped by med, filter dropdown defaults to last-logged
│       └── Settings.tsx       # Notifications, PDF export, backup/restore, clear data
├── index.html                 # HTML shell with PWA meta tags
├── vite.config.ts             # Vite + PWA + allowedHosts config
├── tailwind.config.js         # Custom theme: surface colors, primary teal, dark mode
├── tsconfig.*.json            # TypeScript configs
└── package.json               # Dependencies + scripts
```

---

## 4. Architecture Principles

### 4.1 Data Flow
```
User Action → Page Component → Zustand Store Action → Dexie/IndexedDB → Zustand State Update → UI Re-render
```
- All mutations go through **store actions**, never direct DB access from components.
- Stores handle both persistence AND state updates in a single action.
- Components read from stores using **selectors** (not destructured getters).

### 4.2 Zustand Pattern (Mandatory)
All stores follow this exact pattern:
```typescript
const useStore = create<State>((set, get) => ({
  // State fields
  data: [],
  loading: false,
  initialized: false,

  // Async actions: persist to DB, then update state
  addItem: async (item) => {
    const newItem = { ...item, id: crypto.randomUUID(), createdAt: Date.now() };
    await db.table.add(newItem);
    set((state) => ({ data: [...state.data, newItem] }));
  },

  // Getters: use get() inside, NOT defined on state object
  getComputed: () => {
    const state = get();
    return state.data.filter(...);
  },
}));
```

### 4.3 Selector Pattern in Components (Mandatory)
```tsx
// ✅ CORRECT — selector re-runs on every state change
const medications = useMedicationStore(
  useShallow((state) => state.medications.filter((m) => m.enabled))
);

// ❌ WRONG — getter returns undefined after first state update
const { enabledMedications } = useMedicationStore();
```
**Why:** Zustand v5 replaces the entire state object on `set()`. Getters defined on the initial state object do **not** survive updates.

### 4.4 Page Router
Navigation is handled by `uiStore.activePage` (string enum). `App.tsx` maps page names to components:

| Page Key | Component | Purpose |
|----------|-----------|---------|
| `dashboard` | `Dashboard` | Home overview |
| `log` | `LogDose` | Log a new dose |
| `chart` | `MedicationChart` | View medication level + weight charts |
| `weight` | `WeightTracker` | Log weight + view history |
| `medications` | `Medications` | Manage medications |
| `settings` | `Settings` | Notifications, export, backup, clear data |

Navigation: `useUIStore().setPage('key')`  
Preselect medication for logging: `useUIStore().setLogDoseMedId(med.id)` then `setPage('log')`

---

## 5. Data Model

### 5.1 Core Types (`src/types.ts`)
```typescript
export type Frequency = 'daily' | 'twice-daily' | 'weekly' | 'biweekly';

export interface Medication {
  id: string;                  // UUID (primary key)
  templateId: string;          // Reference to seed library ID (or custom UUID)
  name: string;
  brand: string;
  activeIngredient: string;
  dosageOptions: number[];
  unit: string;                // mg | mcg
  frequency: Frequency;
  halfLifeHours: number;
  color: string;               // Hex color for UI theming
  reminderHoursBefore: number;
  enabled: boolean;            // Whether shown on dashboard
  createdAt: number;           // Unix timestamp
}

export interface Vial {
  id: string;
  medicationId: string;        // FK → medications.id
  name: string;                // Vial label (e.g., "Vial #1")
  peptideAmount: number;       // Total peptide in vial
  peptideUnit: string;         // mg | mcg | units
  bacWaterAmount: number;      // ml of bacteriostatic water
  reconstitutedAt: number;     // Unix timestamp when mixed
  remainingOverride: number | null; // Manual override for remaining amount
  notes: string;
  createdAt: number;
}

export interface Dose {
  id: string;
  medicationId: string;        // FK → medications.id
  vialId?: string;             // FK → vials.id (optional vial link)
  dosage: number;
  unit: string;
  injectionSite: InjectionSite;
  dateTime: number;            // Unix timestamp of dose
  notes: string;
  createdAt: number;
}

export type InjectionSite =
  | 'abdomen-upper-left' | 'abdomen-upper-right'
  | 'abdomen-lower-left' | 'abdomen-lower-right'
  | 'thigh-left' | 'thigh-right'
  | 'arm-left' | 'arm-right';

export interface WeightEntry {
  id: string;
  weight: number;
  unit: 'kg' | 'lb';
  dateTime: number;
  notes: string;
  createdAt: number;
}

export interface AppSettings {
  weightUnit: 'kg' | 'lb';                 // Default for weight entries
  medicationUnit: 'mg' | 'mcg' | 'units';  // Default for custom meds and vials
  notificationsEnabled: boolean;           // Master switch for dose reminders
}
```

### 5.2 IndexedDB Schema (Dexie)
| Table | Primary Key | Indexed Fields |
|-------|-------------|----------------|
| `medications` | `id` | `activeIngredient`, `createdAt` |
| `doses` | `id` | `medicationId`, `dateTime`, `createdAt` |
| `weightEntries` | `id` | `dateTime`, `createdAt` |
| `vials` | `id` | `medicationId`, `createdAt` |
| `settings` | `id` | — |

### 5.3 Seeding Logic
`seedDatabaseIfEmpty()` in `database.ts` handles first-launch seeding:
- A **module-level promise guard** prevents concurrent seed operations (fixes React Strict Mode double-mount).
- Existing library medications are **deduplicated by `templateId`** — duplicates removed (oldest kept).
- **Custom medications** (templateId not in `MEDICATION_LIBRARY`) are never touched.
- Only missing library entries are added.

---

## 6. State Stores Reference

### 6.1 `medicationStore`
| State | Type | Description |
|-------|------|-------------|
| `medications` | `Medication[]` | All medications |
| `doses` | `Dose[]` | All dose entries |
| `loading` | `boolean` | Load in progress |
| `initialized` | `boolean` | Data has been loaded |

| Action | Description |
|--------|-------------|
| `loadData()` | Load medications + doses from IndexedDB |
| `addMedication(med)` | Add new medication |
| `updateMedication(id, updates)` | Partial update |
| `deleteMedication(id)` | Delete med + all its doses |
| `enableMedication(id, enabled)` | Toggle enabled flag |
| `logDose(dose)` | Add new dose entry |
| `updateDose(id, updates)` | Partial update of dose |
| `deleteDose(id)` | Remove dose entry |
| `getMedicationLevel(medId)` | Computed: current concentration |
| `getNextDose(medId)` | Computed: next scheduled dose Date |
| `getTimeUntil(medId)` | Computed: human-readable countdown |
| `getDosesForMedication(medId)` | Computed: sorted dose history |

### 6.2 `weightStore`
| Action | Description |
|--------|-------------|
| `loadData()` | Load weight entries (sorted desc by dateTime) |
| `addEntry(entry)` | Add weight entry |
| `updateEntry(id, updates)` | Partial update |
| `deleteEntry(id)` | Remove entry |
| `getTrend()` | Computed: change + period days |
| `getLatest()` | Computed: most recent entry |

### 6.3 `uiStore`
| State | Type | Description |
|-------|------|-------------|
| `activePage` | `PageId` | Current visible page |
| `logDoseMedId` | `string \| null` | Preselected medication for LogDose |
| `isModalOpen` | `boolean` | Modal visibility |
| `modalContent` | `ReactNode \| null` | Modal body |
| `toasts` | `Toast[]` | Active toast notifications |

| Action | Description |
|--------|-------------|
| `setPage(page)` | Navigate |
| `setLogDoseMedId(id)` | Preselect med for dose logging |
| `openModal(content)` | Show modal |
| `closeModal()` | Hide modal |
| `addToast(msg, type)` | Show toast (auto-dismiss 3s) |
| `removeToast(id)` | Dismiss toast early |

---

## 7. Core Libraries

### 7.1 Half-Life Engine (`lib/halfLifeEngine.ts`)
**Formula:** `C(t) = C₀ × (0.5)^(t / t_half)`

| Function | Purpose |
|----------|---------|
| `concentrationAtTime(dose, halfLife, hoursSince)` | Single dose decay |
| `medicationLevelAtTime(med, doses, timestamp)` | Sum all active doses at time |
| `generateLevelSeries(med, doses, options)` | Time-series for charting |
| `estimateSteadyStateLevel(med)` | Theoretical steady-state concentration |
| `getNextDoseTime(med, doses)` | Next scheduled dose |
| `getTimeUntilNextDose(med, doses)` | Human-readable countdown |
| `allMedicationLevelsAtTime(meds, doses, timestamp)` | All meds at once |

### 7.2 Notification System (`lib/notifications.ts`)
- Uses `window.Notification` (not service worker — **background reminders don't work when app is closed**).
- Polls every 60s via `setInterval` in `App.tsx`.
- Reminders stored in `localStorage` under `pepty-reminders`.
- Only fires once per dose window.

### 7.3 PDF Export (`lib/pdfExport.ts`)
- Uses jsPDF + jspdf-autotable.
- Generates: medication summary table, dose history table, weight history table.
- Multi-page aware (adds new pages when content overflows).

### 7.4 Cloud Sync (`lib/cloudSync.ts`)
**Status: Scaffolding only. Requires user OAuth credentials.**

| Function | Cloud |
|----------|-------|
| `initGoogleDrive(apiKey)` | Google Drive |
| `authenticateGoogleDrive(clientId)` | Google Drive |
| `uploadToGoogleDrive(token, filename, content)` | Google Drive |
| `listBackupsOnGoogleDrive(token)` | Google Drive |
| `downloadFromGoogleDrive(token, fileId)` | Google Drive |
| `authenticateDropbox(clientId)` | Dropbox |
| `uploadToDropbox(token, path, content)` | Dropbox |
| `listDropboxFiles(token, path)` | Dropbox |
| `downloadFromDropbox(token, path)` | Dropbox |

### 7.5 Auto-Backup (`lib/autoBackup.ts`)
- Exports all data to `localStorage` key `peptytrack-autobackup` on every data change.
- Restore prompt appears on app start if DB is empty but backup exists.

---

## 8. Design System

### 8.1 Color Palette (Tailwind Custom)
```javascript
// tailwind.config.js
colors: {
  primary: { 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },  // Teal
  accent: { 400: '#fbbf24', 500: '#f59e0b' },                     // Amber
  surface: { 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' }, // Slate
}
```

### 8.2 Common UI Patterns
```tsx
// Card container
<div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">

// Interactive button
<button className="py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all active:scale-[0.98]">

// Form input
<input className="w-full bg-surface-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50">

// Danger action
<button className="hover:bg-red-500/10 text-red-400">

// Section header
<h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
```

### 8.3 Layout Constraints
- Mobile-first, max-width `max-w-lg` (512px), centered.
- Bottom nav is `fixed` with `safe-area-pb` for notched phones.
- All pages have `pb-24` to clear bottom nav.
- `main` is `relative` for overlay positioning.

---

## 9. Testing

**Run tests:** `npm run test`

| Test File | Coverage |
|-----------|----------|
| `halfLifeEngine.test.ts` | 15 tests — concentration decay, accumulation, series generation, next dose timing |
| `database.test.ts` | 16 tests — CRUD, queries, sorting, seed deduplication & idempotency, vial storage |
| `medicationStore.test.ts` | 5 tests — enable/disable, persistence, custom med creation, dose update |
| `settingsStore.test.ts` | 4 tests — default settings, persist/reload, getSetting, merge with defaults |
| `vialStore.test.ts` | 10 tests — CRUD, remaining computation, filtering, last used, remaining override |
| `ConfirmDialog.test.tsx` | 7 tests — rendering, confirm/cancel actions, danger styling, modal close |

### 9.1 Testing Patterns
- Use `fake-indexeddb` for IndexedDB mocking in tests.
- Reset seed promise guard before DB tests: `_resetSeedPromiseForTests()`.
- Test both state updates AND persistence.

---

## 10. How to Add a Feature

### 10.1 Add a New Page
1. Create component in `src/pages/NewPage.tsx`
2. Add entry to `PAGE_COMPONENTS` in `App.tsx`
3. Add nav item to `NAV_ITEMS` in `BottomNav.tsx`
4. Add `PageId` to `uiStore.ts` type union
5. Export from `App.tsx` import block

### 10.2 Add a New Data Entity
1. Add interface to `src/types.ts`
2. Add table to Dexie schema in `src/db/database.ts` (bump schema version if needed)
3. Create store in `src/stores/` following Zustand pattern
4. Add CRUD actions + load sequence in `App.tsx`
5. Write tests in `src/db/database.test.ts` and store test file

### 10.3 Add a New Chart or Visualization
1. Use `Recharts` components (already imported).
2. For medication levels, use `generateLevelSeries()` from `halfLifeEngine.ts`.
3. For dual-axis charts, use `<ComposedChart>` with two `<YAxis>` components.
4. Follow existing color theming from medication `color` fields.

### 10.4 Add a New Notification/Reminder Type
1. Extend `notifications.ts` with new schedule function.
2. Store reminders in `localStorage` under a new key (prefix: `pepty-`).
3. Add check to the 60s polling interval in `App.tsx`.

---

## 11. Common Pitfalls & Gotchas

| # | Pitfall | Solution |
|---|---------|----------|
| 1 | **Zustand getters on state object** | Always use `get()` inside actions; in components use selectors with `useShallow` |
| 2 | **React Strict Mode double-mount** | Seeding uses a module-level promise guard — never remove it |
| 3 | **Dexie schema changes** | Dexie v1 is active. If you add an index, bump `this.version(N)` and write a migration |
| 4 | **Dynamic import of database.ts** | `database.ts` is both statically and dynamically imported — consolidate if changing |
| 5 | **Recharts tooltip types** | Requires manual casting — not fully type-safe, use `as` carefully |
| 6 | **Notification permission state** | `notificationsEnabled` in `Settings.tsx` is local state, not persisted. Use `settingsStore` if implementing |
| 7 | **Weight unit mixing** | Weight entries store raw values. Charts and trends don't normalize kg/lb — normalize before display |
| 8 | **Cloud sync CLIENT_ID** | `cloudSync.ts` scaffolding has no UI for entering credentials. Add inputs to Settings if wiring up |

---

## 12. Known Issues & Evolution Opportunities

### 12.1 Critical — Must Fix
| # | Item | Location | Description |
|---|---|------|----------|-------------|
| 1 | **Auto-backup excludes settings** | `src/lib/cloudSync.ts` | ✅ Fixed. `exportData` now includes `settings`; `importData` restores them. Backup version bumped to 3. |
| 2 | **Clear All Data incomplete** | `src/pages/Settings.tsx` | ✅ Fixed. Now clears vials and settings tables, and reloads all stores. |
| 3 | **Vials inline in Medications** | `src/pages/Medications.tsx` | ✅ Fixed. Vials moved to dedicated `Vials.tsx` page with grouped-by-medication layout and bottom nav tab. |
| 4 | **Auto-seed library medications** | `src/db/database.ts` | ✅ Removed. `seedDatabaseIfEmpty()` no longer called on init. Medications tab starts empty; users add from library manually. |
| 5 | **Notifications not wired to SW** | `src/lib/notifications.ts` | Uses `window.Notification` only. Background reminders fail when app is closed. **Partial fix:** reminders now gated behind `settings.notificationsEnabled` master switch. |

### 12.2 Feature Opportunities
| # | Item | Description |
|---|------|-------------|
| 4 | **Cloud sync OAuth UI** | Add input fields in Settings for Google/Dropbox credentials; wire up backup/restore buttons |
| 5 | **Weight unit normalization** | Convert all weight entries to a canonical unit for charts; display in user's preferred unit |
| 6 | **Medication level history** | Store calculated levels over time for more accurate historical charting |
| 7 | **Export format options** | Add CSV export, embed charts in PDF |
| 8 | **i18n / localization** | Add react-i18next or similar framework; extract all user-facing strings |
| 9 | **Data migration system** | IndexedDB schema v1 has no migration path. Implement Dexie migration hooks |
| 10 | **Analytics / insights** | Streak tracking, adherence %, med-to-weight correlation analysis |
| 11 | **Code splitting** | Main bundle ~1.15 MB. Use `React.lazy()` + dynamic imports for pages |
| 12 | **E2E testing** | Add Playwright or Cypress for critical user flows |
| 13 | **Service Worker push notifications** | Implement background dose reminders via Push API |
| 14 | **Injection site rotation tracker** | Track last used site per medication; suggest rotation to avoid lipohypertrophy |
| 15 | **Medication supply tracking** | Track vial/pens remaining; alert when running low |
| 16 | **Multi-user support** | Add profiles for household sharing |
| 17 | **Dark/light theme toggle** | Currently dark-only. Add light theme variant |

### 12.3 Technical Debt
| # | Item | Description |
|---|------|-------------|
| 18 | **Chunk size** | Main JS bundle ~1.15 MB. Consider dynamic `import()` for pages |
| 19 | **Vite dynamic import warning** | `database.ts` is both statically and dynamically imported — consolidate |
| 20 | **Type safety in charts** | Recharts Tooltip formatter types require manual casting |
| 21 | **No e2e tests** | No browser automation for critical flows |
| 22 | **react-router-dom unused** | Listed in dependencies but custom router used — remove or migrate |
| 23 | **Service Worker push notifications** | Web Push API or Periodic Background Sync needed for true background reminders. Limited mobile browser support. |

---

## 13. Deployment

### Local Development
```bash
npm install
npm run dev        # http://localhost:5173/
npx vite --host    # Exposes to local network (for phone testing)
```

### Production Build
```bash
npm run build      # Outputs to dist/
npm run test       # Runs unit tests
```

### Netlify Deploy
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

**Live:** https://peptytrack.netlify.app

### Phone Installation
1. Build the app
2. Expose via `--host` or Cloudflare tunnel (`cloudflared`)
3. Open HTTPS URL on phone browser
4. Chrome shows "Install App" (requires HTTPS + valid manifest)

---

## 14. Agent Checklist Before Committing Changes

- [ ] Does the change follow the Zustand store pattern (§4.2)?
- [ ] Are components using selectors with `useShallow` (§4.3)?
- [ ] If modifying types, is `src/types.ts` updated?
- [ ] If modifying DB schema, is the Dexie version bumped with migration?
- [ ] Are new pure functions placed in `src/lib/`?
- [ ] Are new UI components placed in `src/components/`?
- [ ] Are new pages placed in `src/pages/` and registered in `App.tsx` + `BottomNav.tsx`?
- [ ] If adding strings, are they consistent with existing tone (friendly, medical-adjacent but not clinical)?
- [ ] Are tests added for new logic?
- [ ] Do all existing tests pass (`npm run test`)?
- [ ] Does the build succeed (`npm run build`)?
- [ ] If adding features, is `architecture.md` updated?
- [ ] If user-facing changes, is `README.md` updated?

---

## 15. Evolution Roadmap (Suggested Priority)

### Phase 1: Foundation Hardening
1. ✅ Wire up `settingsStore` (weight unit, notification master switch)
2. ✅ Use `Modal` + `ConfirmDialog` for confirmation dialogs (delete dose, clear data)
3. ✅ Include settings in backup/restore (version 3)
4. ✅ Make "Clear All Data" truly clear everything (vials, settings)
5. Normalize weight units for chart accuracy

### Phase 2: UX Improvements
5. Add injection site rotation suggestions
6. Add medication supply/pen tracking
7. Improve PDF export (add charts, better styling)
8. Add CSV export option

### Phase 3: Intelligence
9. Add adherence streak tracking
10. Add medication-to-weight correlation insights
11. Store historical level calculations for better chart accuracy

### Phase 4: Scale
12. i18n framework + initial translations
13. Code splitting with React.lazy
14. E2E tests with Playwright
15. Service Worker push notifications

---

> **Last Updated:** 2026-05-06  
> **Document Version:** 1.1
