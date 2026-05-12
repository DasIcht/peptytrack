# PeptyTrack — Architecture Document

> **Purpose:** This document describes the overall architecture, data flow, component relationships, and known outstanding items for the PeptyTrack GLP-1 medication tracker PWA.
> **Last Updated:** 2026-05-12

---

## 1. Overview

PeptyTrack is a privacy-first, offline-capable Progressive Web App (PWA) that tracks GLP-1 medication dosing, estimates blood concentration levels via half-life pharmacokinetics, logs weight history, and generates doctor-ready reports.

### Key Principles
- **100% on-device data storage** — IndexedDB via Dexie; no external health data transmission
- **Offline-first** — PWA service worker caches all assets; app functions without network
- **Internet only for optional cloud backup** — Google Drive / Dropbox sync is user-initiated only
- **Mobile-first dark UI** — Tailwind CSS with custom teal/slate palette, max-width 512px

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 + TypeScript | UI rendering |
| Build Tool | Vite 8 | Dev server, bundling, HMR |
| Styling | Tailwind CSS | Utility-first dark-themed CSS |
| PWA | `vite-plugin-pwa` | Service worker, manifest, offline precaching |
| State Management | Zustand 5 | Lightweight global state |
| Local Database | Dexie (IndexedDB wrapper) | Structured on-device storage |
| Charts | Recharts | Medication level & weight visualizations |
| Date/Time | date-fns | Date formatting & manipulation |
| PDF Export | jsPDF | Doctor report generation |
| Icons | Lucide React | Consistent iconography |
| Testing | Vitest + fake-indexeddb | Unit testing with IndexedDB mock |

---

## 3. Project Structure

```
peptyTrack/
├── public/                    # Static PWA assets
│   ├── favicon.svg            # Browser tab icon
│   ├── icon-192.png           # PWA icon (192×192)
│   └── icon-512.png           # PWA icon (512×512)
│
├── src/
│   ├── App.tsx                # Root component — page router, init, reminder polling, auto-backup, restore prompt
│   ├── main.tsx               # React DOM mount point
│   ├── types.ts               # Shared TypeScript interfaces
│   │
│   ├── styles/
│   │   └── global.css         # Tailwind directives + custom utilities
│   │
│   ├── db/                    # Database layer
│   │   ├── database.ts        # Dexie schema, CRUD helpers, seeding
│   │   ├── database.test.ts   # DB unit tests
│   │   └── seed.ts            # Pre-populated GLP-1 medication library (8 drugs)
│   │
│   ├── stores/                # Zustand global state (one per domain)
│   │   ├── medicationStore.ts # Medication + dose state + computed getters
│   │   ├── weightStore.ts     # Weight entry state + trend calculations
│   │   ├── uiStore.ts         # Page navigation, modals, toast notifications
│   │   └── settingsStore.ts   # App settings (currently minimal)
│   │
│   ├── lib/                   # Core business logic (pure functions)
│   │   ├── halfLifeEngine.ts      # Pharmacokinetic accumulation model
│   │   ├── halfLifeEngine.test.ts # Engine unit tests
│   │   ├── notifications.ts       # Browser notification permission + scheduling
│   │   ├── pdfExport.ts           # PDF report generation (jsPDF)
│   │   ├── cloudSync.ts           # Google Drive / Dropbox OAuth + backup/restore
│   │   ├── autoBackup.ts          # localStorage auto-backup + restore helpers
│   │   └── titrationAnalytics.ts  # Logic for dose step-up readiness and safety scoring
│   │
│   ├── components/            # Reusable UI components
│   │   ├── BottomNav.tsx      # Fixed bottom tab bar (7 tabs)
│   │   ├── MedicationCard.tsx # Dashboard medication card with level gauge
│   │   ├── Modal.tsx          # Generic modal wrapper
│   │   ├── ConfirmDialog.tsx  # Styled confirmation dialog for destructive actions
│   │   ├── SideEffectChips.tsx # Tap-to-toggle side effect chips + custom add
│   │   ├── CircularProgress.tsx # Animated SVG circular progress indicator
│   │   ├── TitrationWizard.tsx # Protocol management wizard with interactive steps
│   │   ├── TitrationDecisionChart.tsx # Radar/Gauge/Timeline visualizations for titration readiness
│   │   └── Toast.tsx          # Toast notification system
│   │
│   └── pages/                 # Full-page route components
│       ├── Dashboard.tsx      # Home — stats, medication cards, quick actions
│       ├── LogDose.tsx        # Dual-mode dose logging: Quick Log (compact 3-tap flow) and Full Log (complete form). 2-column vial layout (dropdown + summary). Compact single-row dosage pills. 2-column injection site selector (zone list | site grid). Circular vial progress, expandable notes, animated side effects, timeline-style dose history
│       ├── MedicationChart.tsx# Dual-axis medication level + weight chart
│       ├── WeightTracker.tsx  # Weight logging with date picker + history
│       ├── Medications.tsx    # Medication management — add from library/custom, enable/disable
│       ├── Vials.tsx          # Vial management grouped by med, filter dropdown defaults to last-logged
│       └── Settings.tsx       # Notifications, PDF export, backup/restore, clear data
│
├── index.html                 # HTML shell with PWA meta tags
├── vite.config.ts             # Vite + PWA + allowedHosts config
├── tailwind.config.js         # Custom theme colors, dark mode, animations
└── package.json               # Dependencies + scripts
```

---

## 4. Data Model

### 4.1 Core Types (`src/types.ts`)

```typescript
interface Medication {
  id: string;                  // UUID (primary key)
  templateId: string;          // Reference to seed library ID
  name: string;                // Display name (e.g., "Semaglutide")
  brand: string;               // Brand names (e.g., "Ozempic / Wegovy")
  activeIngredient: string;    // Generic name
  dosageOptions: number[];     // Available dosages (e.g., [0.25, 0.5, 1])
  unit: string;                // mg | mcg
  frequency: 'daily' | 'weekly' | 'twice-daily';
  halfLifeHours: number;       // Pharmacokinetic half-life (e.g., 168)
  color: string;               // Hex color for UI theming
  reminderHoursBefore: number; // Configurable reminder offset
  enabled: boolean;            // Whether shown on dashboard/home
  createdAt: number;           // Unix timestamp
}

  notes: string;
  sideEffects?: SideEffectLog[]; // Logged side effects with severity
  createdAt: number;
}

interface ProtocolStep {
  id: string;
  dosage: number;
  durationWeeks: number;
}

interface Protocol {
  id: string;
  medicationId: string;
  name: string;
  steps: ProtocolStep[];
  currentStepIndex: number;
  startDate: number | null;
  currentStepStartDate: number | null;
  autoAdvance: boolean;
  chartStyle?: 'spider' | 'gauges' | 'timeline';
  createdAt: number;
}

type SideEffectSeverity = 'mild' | 'moderate' | 'severe';

interface SideEffectLog {
  label: string;
  severity: SideEffectSeverity;
}

interface SymptomLog {
  id: string;
  medicationId: string;
  dateTime: number;
  symptoms: SideEffectLog[];
  createdAt: number;
}

interface CustomSideEffects {
  medicationId: string;         // PK → medications.id
  labels: string[];             // User-defined side effect labels
}

interface Vial {
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

interface AppSettings {
  weightUnit: 'kg' | 'lb';
  medicationUnit: 'mg' | 'mcg' | 'units';
  notificationsEnabled: boolean;
  injectionRotationStrategy: RotationStrategy;
  injectionRotationSites: InjectionSite[];
  titrationWizardEnabled: boolean;
  severeSideEffectThreshold: number;
}

interface TitrationMetrics {
  timeProgressPercent: number;
  symptomScore: number;
  weightLossRateKgPerWeek: number;
  daysRemaining: number;
  hasWeightData: boolean;
  hasSymptomData: boolean;
}
```

### 4.2 IndexedDB Schema (Dexie)

| Table | Primary Key | Indexed Fields |
|-------|-------------|----------------|
| `medications` | `id` | `activeIngredient`, `createdAt` |
| `doses` | `id` | `medicationId`, `vialId`, `dateTime`, `createdAt` |
| `weightEntries` | `id` | `dateTime`, `createdAt` |
| `vials` | `id` | `medicationId`, `createdAt` |
| `settings` | `id` | — |
| `customSideEffects` | `medicationId` | — |
| `symptomLogs` | `id` | `medicationId`, `dateTime`, `createdAt` |

### 4.3 Seeding Logic

`seedDatabaseIfEmpty()` in `database.ts` seeds the 8 GLP-1 medications from `seed.ts` on first launch.

**Idempotency guarantees:**
- A module-level promise guard prevents concurrent seed operations (fixes React Strict Mode double-mount race condition).
- On every run, existing library medications are **deduplicated by `templateId`** — duplicates are removed (oldest entry kept).
- **Custom medications** (those with a `templateId` not present in `MEDICATION_LIBRARY`) are never touched during deduplication.
- Only missing library entries are added.

---

## 5. State Management Architecture

### 5.1 Store Overview

| Store | Responsibility | Key State |
|-------|---------------|-----------|
| `medicationStore` | Medication + dose CRUD (incl. dose update/delete), computed levels | `medications[]`, `doses[]`, `initialized` |
| `weightStore` | Weight entry CRUD (incl. update/delete), trend calculation | `entries[]` |
| `uiStore` | Navigation, modals, toast queue, log-dose preselection | `activePage`, `logDoseMedId`, `toasts[]`, `modalConfig` |
| `settingsStore` | App preferences (weightUnit, medicationUnit, notificationsEnabled, injectionRotationStrategy, injectionRotationSites) | `settings` |
| `vialStore` | Vial CRUD + computed remaining tracking | `vials[]`, `initialized` |
| `sideEffectsStore` | Per-medication custom side effects CRUD + persistence | `customEffects: Record<string, string[]>`, `initialized` |
| `symptomLogStore` | Independent symptom entry CRUD (decoupled from doses) | `logs[]`, `initialized` |
| `protocolStore` | Titration protocol CRUD + step tracking | `protocols[]`, `initialized` |

### 5.2 Store Pattern

All stores follow Zustand's functional pattern:
```typescript
const useStore = create<State>((set, get) => ({
  // State
  data: [],
  // Actions (async CRUD)
  loadData: async () => { /* fetch from IndexedDB */ },
  addItem: async (item) => { /* persist + update state */ },
  // Getters (computed from state + other stores)
  getTrend: () => { /* derive from entries */ },
}));
```

### 5.3 Important: No Getters on State Object

Zustand v5 replaces the entire state object on every `set()`. Getters defined on the initial state object do **not** survive updates. Components must use **selectors** (Zustand's subscription pattern) or filter data inline.

**Example (Dashboard.tsx):**
```tsx
// ✅ Correct — selector re-runs on every state change
const medications = useMedicationStore(
  useShallow((state) => state.medications.filter((m) => m.enabled))
);

// ❌ Incorrect — getter returns undefined after first state update
const { enabledMedications } = useMedicationStore();
```

---

## 6. Page Router

Navigation is handled by `uiStore.activePage` (string enum). `App.tsx` maps page names to components:

| Page Key | Component | Route Purpose |
|----------|-----------|---------------|
| `dashboard` | `Dashboard` | Home overview |
| `log` | `LogDose` | Log a new dose |
| `chart` | `MedicationChart` | View medication level + weight charts |
| `weight` | `WeightTracker` | Log weight + view history |
| `medications` | `Medications` | Manage medications — add from library or custom, enable/disable, edit |
| `vials` | `Vials` | Manage vials grouped by medication. Filter dropdown defaults to last-logged med |
| `settings` | `Settings` | Notifications, export, backup, clear data |

Navigation triggers via `useUIStore().setPage('key')`.

> **Swipe Navigation:** The main content area supports touch swipe gestures. Swipe left to advance to the next tab, swipe right to go back. Implemented via `touchstart`/`touchend` handlers on the `<main>` element in `App.tsx` using `uiStore.nextPage()` / `uiStore.prevPage()`.

---

## 7. Core Libraries & Algorithms

### 7.1 Half-Life Engine (`lib/halfLifeEngine.ts`)

**Purpose:** Estimate medication blood concentration over time using pharmacokinetic accumulation.

**Formula:** `C(t) = C₀ × (0.5)^(t / t_half)`

**Key Functions:**
- `concentrationAtTime(dosage, halfLifeHours, hoursSinceDose)` — Single dose decay
- `medicationLevelAtTime(med, doses, timestamp)` — Sums all active doses at a given time
- `generateLevelSeries(med, doses, options)` — Generates time-series data for charting
- `getNextDoseTime(med, doses)` — Calculates next scheduled dose based on frequency
- `getTimeUntilNextDose(med, doses)` — Human-readable countdown string

### 7.2 Notification System (`lib/notifications.ts`)

- Requests browser notification permission
- Schedules dose reminders based on `medication.reminderHoursBefore`
- Polls every 60 seconds via `setInterval` in `App.tsx`
- Reminders fire only once per dose window (tracked via `localStorage`)

### 7.3 PDF Export (`lib/pdfExport.ts`)

- Uses jsPDF to generate doctor-ready reports
- Includes: medication list, dose history table, weight trend summary
- Triggered from Settings → "Export PDF Report"

### 7.4 Cloud Sync (`lib/cloudSync.ts`)

**Status: Scaffolding implemented, requires user OAuth credentials**

- Google Drive OAuth 2.0 flow (requires `CLIENT_ID`)
- Dropbox OAuth flow (requires `APP_KEY`)
- Backup: exports all IndexedDB data to JSON → uploads to cloud
- Restore: downloads JSON → imports back into IndexedDB

### 7.5 Data Migration Engine (`lib/cloudSync.ts`)

**Purpose:** Handle evolution of backup file formats and ensure forward compatibility.

**Key Features:**
- **Decoupled Versions:** `BACKUP_VERSION` is managed independently of the IndexedDB schema version.
- **Migration Pipeline:** A sequence of pure transformation functions that upgrade data from version `N` to `N+1`.
- **Structural Validation:** `validateBackup.ts` performs a lightweight structural check on imported data before writing to IndexedDB.
- **App Version Tracking:** Backups include `appVersion` (injected from `package.json` via Vite) for traceability.

**Migrations implemented:**
- `v1-v4`: Ensures missing tables (vials, protocols, symptomLogs, etc.) are initialized as empty arrays.
- `v4-v5`: Migrates string-based `sideEffects` on doses to the new object format `{label, severity}`.
- `v5-v6`: Adds `appVersion` metadata.

### 7.5 Side Effects Library (`lib/sideEffects.ts`)

**Purpose:** Curated GLP-1 side effects library with intelligent per-medication ordering.

**Standard Library:** 22 clinically-categorized side effects organized by rarity (very-common → very-rare).

**Key Functions:**
- `getSideEffectsByRarity()` — Returns all standard effects sorted by frequency
- `getSideEffectsOrderedForMedication(medicationId, doses, customEffects)` — Smart ordering:
  1. Previously selected effects for this medication (alphabetical)
  2. Remaining standard effects (by rarity, most common first)
  3. Custom user-defined effects (alphabetical)

### 7.6 Injection Rotation (`lib/injectionRotation.ts`)

**Purpose:** Compute the next injection site based on global rotation strategy.

**Strategies:**
- `sequential` — Fixed-order cycle through active sites
- `quadrant` — Cycles abdomen → thighs → arms (quadrant-prioritized)
- `lru` — Least-recently-used site (global across all doses)

**Key Functions:**
- `getNextInjectionSite(doses, strategy, activeSites)` — Returns next `InjectionSite`
- `getLastUsedSite(doses)` — Most recent injection site across all doses

### 7.7 Titration Analytics (`lib/titrationAnalytics.ts`)

**Purpose:** Evaluate readiness for dose step-up based on protocol, side effects, and weight trends.

**Logic:**
- **Weighted Severity:** Side effects are assigned points: Mild=1, Moderate=2, Severe=3. Strings are treated as 'mild'.
- **Log-Derived Start Dates:** The system identifies the actual start date of the current dosage level from dose history logs, ensuring "Time Progress" is accurate even if protocol dates were set nominally.
- **Monitored Windows:** Weight trends are calculated over the last **4 weeks**. Symptom scores are calculated over the last **2 weeks**.
- **Data Integrity:** "Weight Stability" requires at least **2 weight logs** in the last 4 weeks. "Symptom Tolerance" requires at least **1 dose or symptom log** in the last 2 weeks. If data is missing, the corresponding readiness metric drops to **0%**.
- **Safety Warnings:** A high-priority red banner appears in the Log Dose flow if the symptom score reaches `settings.severeSideEffectThreshold` (default: 5).
- **Auto-Advance:** Optionally advances protocol steps on successful dose log if recommendation is "step-up".

### 7.8 Titration Charts (`src/components/TitrationDecisionChart.tsx`)

**Purpose:** Visual visualization of titration readiness parameters.

**Styles:**
- `spider` — Radar chart showing Time Progress, Symptom Tolerance, and Weight Stability.
- `gauges` — Three circular progress rings for key metrics.
- `timeline` — Bar chart of symptom scores over the last 14 days.

---

## 8. Data Flow

### 8.1 Initial Load Sequence
```
App.tsx mounts
  └─> seedDatabaseIfEmpty()  → Seeds 7 GLP-1 meds if DB empty
  └─> medicationStore.loadData() → Loads medications + doses from IndexedDB
  └─> weightStore.loadData()     → Loads weight entries from IndexedDB
  └─> vialStore.loadData()       → Loads vials from IndexedDB
  └─> symptomLogStore.loadData() → Loads independent symptom logs
  └─> settingsStore.loadSettings() → Loads app preferences
  └─> Reminder polling starts (60s interval)
```

### 8.2 Dose Logging Flow
```
User taps a medication card on Dashboard
  └─> uiStore.setLogDoseMedId(med.id)
  └─> uiStore.setPage('log')
  └─> LogDose.tsx
      └─> Preselects medication from uiStore.logDoseMedId (cleared after read)
      └─> User picks vial (optional), dosage, site, date/time
      └─> Injection site auto-rotates based on global strategy (sequential/quadrant/LRU)
      └─> Side effects chip grid (tap to toggle) with "+ Add Custom" option
      └─> Vial remaining is displayed in real time
      └─> Submit → medicationStore.logDose(dose) or updateDose(id, updates)
          └─> Persists to IndexedDB (db.doses.add / update), includes vialId + sideEffects
          └─> Updates Zustand state
          └─> Toast: "Dose logged!" / "Dose updated!"
          └─> Triggers notification reschedule
      └─> Dose history list below form — click to edit, delete button to remove
```

### 8.3 Chart Rendering Flow
```
User navigates to Chart tab
  └─> MedicationChart.tsx
      └─> Renders level series for ALL enabled medications by default
      └─> Merges weight data from weightStore
      └─> Recharts renders multi-series AreaChart with legend
      └─> Clicking legend items toggles visibility of individual meds / weight
```

---

## 9. Component Relationships

```
App.tsx
├── main content (activePage)
│   ├── Dashboard.tsx
│   │   └── MedicationCard[] (per enabled medication)
│   ├── LogDose.tsx
│   │   └── VialSelector + RemainingDisplay
│   ├── MedicationChart.tsx
│   ├── WeightTracker.tsx
│   ├── Medications.tsx
│   │   └── VialList (per medication)
│   └── Settings.tsx
│
├── BottomNav.tsx          (fixed, all pages)
├── ToastContainer.tsx     (overlay, all pages)
└── Modal.tsx              (overlay, all pages)
```

---

## 10. PWA Configuration

### Manifest (`vite-plugin-pwa` generates this)
- `display: standalone` — Launches without browser chrome
- `theme_color: #0f172a` — Matches dark background
- `start_url: '/'` — Entry point
- Icons: 192×192 and 512×192 PNG

### Service Worker
- Precaches all JS/CSS/HTML/assets
- Workbox handles offline fallback
- Auto-updates when new version detected

### Dev Server Config
- `server.allowedHosts: true` — Required for Cloudflare tunnel access
- `--host` flag exposes to local network

---

## 11. Testing

| Test File | Coverage |
|-----------|----------|
| `halfLifeEngine.test.ts` | 15 tests — concentration decay, dose accumulation, series generation, next dose timing |
| `database.test.ts` | 16 tests — medication CRUD, dose queries, weight sorting, settings persistence, seed deduplication & idempotency, vial CRUD |
| `medicationStore.test.ts` | 5 tests — enable/disable toggle, state persistence across reloads, custom medication creation, dose update |
| `settingsStore.test.ts` | 4 tests — default settings, persist/reload, getSetting, merge with defaults |
| `vialStore.test.ts` | 10 tests — CRUD, remaining computation, filtering, last used, remaining override |
| `ConfirmDialog.test.tsx` | 7 tests — rendering, confirm/cancel actions, danger styling, modal close |
| `sideEffects.test.ts` | 8 tests — rarity ordering, per-medication smart sorting, deduplication |
| `sideEffectsStore.test.ts` | 7 tests — CRUD, persistence, deduplication, per-med isolation |
| `SideEffectChips.test.tsx` | 6 tests — rendering, toggle selection, custom add |
| `injectionRotation.test.ts` | 12 tests — sequential, quadrant, LRU strategies, activeSites subset |

**Run tests:** `npm run test`

---

## 12. Known Outstanding Items / TODOs

### 12.1 Critical — Must Fix

| # | Item | Location | Description |
|---|------|----------|-------------|
| 1 | ~~settingsStore unused~~ | ✅ `src/stores/settingsStore.ts` | Implemented. Wires weight unit default, notification master switch, persists to IndexedDB settings table. |
| 2 | ~~Modal component unused~~ | ✅ `src/components/Modal.tsx` | Implemented. `ConfirmDialog` component used via `openModal()` for delete confirmations across LogDose, WeightTracker, Medications, and Settings pages. |
| 3 | **Notifications not wired to SW** | `src/lib/notifications.ts` | Reminders use `window.Notification` but are not connected to the service worker. Background reminders won't work when app is closed. **Partial fix:** reminders now gated behind `settings.notificationsEnabled` master switch. |

### 12.2 Features — Nice to Have

| # | Item | Description |
|---|------|-------------|
| 4 | **Cloud sync needs OAuth setup** | `cloudSync.ts` has scaffolding but requires user's Google/Dropbox API credentials. Needs UI flow to input CLIENT_ID. |
| 5 | **Weight unit conversion** | Weight entries are stored as-logged (kg/lb). Charts and trend calculations don't normalize — mixed units distort trends. |
| 6 | **Medication level history** | Currently only shows current level. Could store calculated levels over time for more accurate historical charts. |
| 7 | **Export format options** | PDF export is basic. Could add CSV export, or include charts in the PDF. |
| 8 | ~~Dose editing~~ | ✅ Implemented. LogDose page now shows a history list. Click any entry to populate the form for editing. |
| 12 | **Medication property editing** | ✅ Implemented. Medications page now has an inline edit mode via the pencil icon that lets users change name, brand, active ingredient, dosages, unit, frequency, half-life, color, and reminder. |
| 9 | ~~Custom medications~~ | ✅ Implemented. Users can add any medication via the Custom tab in the Add Medication modal. |
| 10 | **i18n / localization** | App is English-only. No internationalization framework in place. |
| 11 | **Data migration** | IndexedDB schema is v1. No migration path if schema changes in future versions. |
| 12 | **Netlify deployment** | ✅ Implemented. Deployed at https://peptytrack.netlify.app with auto-update support. |
| 12 | **Analytics / insights** | Could add streak tracking (consecutive doses), adherence percentage, correlation between medication level and weight change. |

### 12.3 Technical Debt

| # | Item | Description |
|---|------|-------------|
| 13 | **Chunk size** | Main JS bundle is ~1.15 MB. Consider code-splitting pages with dynamic `import()` to reduce initial load. |
| 14 | **Vite dynamic import warning** | `database.ts` is both statically and dynamically imported — dynamic import is ineffective. Consolidate imports. |
| 15 | **Type safety in charts** | Recharts `Tooltip` formatter types require manual casting — not type-safe. |
| 16 | **E2E Playwright Tests** | ✅ Playwright suite in `e2e/` — 7 spec files covering auth, dose logging, vial management, weight tracking, backup/restore, medication creation. Standardized with `navigateTo`, `dbSeed`, `resetApp` patterns. **77% pass rate** (27/35 tests passing; 8 skipped for Phase 2). See `e2e/WALKTHROUGH.md`. |
| 17 | **Service Worker push notifications** | Web Push API or Periodic Background Sync needed for true background reminders. Limited mobile browser support. |

---

## 13. Deployment Notes

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

### Phone Installation
1. Build the app
2. Expose via `--host` or use Cloudflare tunnel (`cloudflared`)
3. Open HTTPS URL on phone browser
4. Chrome should show "Install App" (requires HTTPS + valid manifest)

---

## 14. Change Log

| Date | Change |
|------|--------|
| 2026-04-29 | Initial architecture document |
| 2026-04-29 | Added `enabled` field to Medication; Dashboard filters by enabled |
| 2026-05-06 | Added vial support: `Vial` type, `vialStore`, schema v2, vial selector in LogDose, inline vial management in Medications page |
| 2026-05-07 | Updated IndexedDB to schema v3 (`customSideEffects` table). |
| 2026-05-07 | Updated IndexedDB to schema v4 (vials and settings included in cloud backup). |
| 2026-05-09 | Updated IndexedDB to schema v5 (`symptomLogs` table, `doses.sideEffects` migration to objects). |
| 2026-04-29 | Added date/time picker to WeightTracker |
| 2026-04-29 | Merged weight data into MedicationChart (dual-axis) |
| 2026-04-29 | Fixed seeding deduplication by `templateId` |
| 2026-04-29 | Added enable/disable toggle to Medications page |
| 2026-04-29 | Fixed seed race condition causing duplicate library meds on app init |
| 2026-04-29 | Added custom medication creation via Library/Custom tabs in Add Medication modal |
| 2026-04-29 | Dashboard: medication cards now navigate to Log Dose with med preselected; removed Log Dose quick-action button |
| 2026-04-29 | Chart: shows all enabled medications by default; removed dropdown; legend click toggles med/weight visibility |
| 2026-04-29 | LogDose: added dose history list with edit/delete; button switches between "Log Dose" and "Update Dose" |
| 2026-04-29 | WeightTracker: added weight entry history with edit/delete; button switches between "Log Weight" and "Update Weight" |
| 2026-04-29 | LogDose dropdown now only shows medications that have logged doses |
| 2026-04-29 | Added Retatrutide to the GLP-1 medication library |
| 2026-04-29 | Medications tab: inline full edit mode (name, brand, ingredient, dosages, unit, frequency, half-life, color, reminder) via pencil icon |
| 2026-04-29 | Added auto-backup to localStorage on every data change with restore prompt on empty DB startup |
| 2026-04-29 | Deployed to Netlify at https://peptytrack.netlify.app with permanent URL and auto-update support |
| 2026-05-05 | Created `settingsStore.ts` — persisted weightUnit, medicationUnit, notificationsEnabled, injectionRotationStrategy, injectionRotationSites to IndexedDB |
| 2026-05-05 | Settings page: added Preferences section with weight unit toggle and notification master switch |
| 2026-05-05 | WeightTracker: default unit now driven by `settingsStore.weightUnit` |
| 2026-05-05 | App: reminder polling gated behind `settings.notificationsEnabled`; settings loaded on init |
| 2026-05-05 | Created `ConfirmDialog.tsx` — reusable styled confirmation dialog for destructive actions |
| 2026-05-05 | Replaced all `window.confirm()` with `openModal(<ConfirmDialog />)` in LogDose, WeightTracker, Medications, Settings |
| 2026-05-05 | Added `settingsStore.test.ts` (4 tests) and `ConfirmDialog.test.tsx` (7 tests) |
| 2026-05-05 | Configured `vitest.config.ts` with jsdom environment and jest-dom matchers setup |
| 2026-05-06 | Backup/restore now includes settings (version 3). "Clear All Data" now clears vials and settings. Import reloads all stores. |
| 2026-05-07 | Added touch swipe navigation between tabs. Added structured side effects logging with curated GLP-1 library, custom side effects, and smart per-medication ordering. Updated IndexedDB schema to v3 (`customSideEffects` table). Bumped cloud backup to v4. Added Side Effects column to PDF export. |
| 2026-05-07 | Added injection site rotation: 3 strategies (sequential, quadrant, LRU), user-selectable active sites (min 2), auto-defaults in LogDose. Settings persist in IndexedDB and included in backup v4. |
| 2026-05-08 | Premium redesign of LogDose: gradient hero header, grouped glass-morphism cards, `CircularProgress` vial indicator, tactile dosage pills, visual injection site zones with emoji, icon-integrated inputs, expandable notes card, animated side effects chips, gradient submit button, timeline-style dose history. Added `card-premium`, `input-premium`, `btn-tactile`, and stagger animations to global.css and tailwind.config.js. |
| 2026-05-08 | Dual-mode Quick Log / Full Log redesign: segmented mode toggle persisted in localStorage. Quick Log shows medication + 2-column vial (dropdown + summary) + compact single-row dosage pills + 2-column injection site selector + submit. Full Log adds date/time, notes, side effects, full vial dashboard with CircularProgress. Injection site redesigned as 2-column layout: left = zone buttons, right = 2×2 site grid. Added `mode-toggle`, `zone-strip`, `zone-card`, `vial-summary`, `no-scrollbar` utilities. Added 17 LogDose unit tests. |
| 2026-05-09 | Implemented Side Effect Severity tracking (Mild/Moderate/Severe) with weighted titration analytics (Mild=1, Mod=2, Sev=3). Tapping symptom chips now cycles severity. Added independent symptom logging decoupled from dose entries. Updated IndexedDB to v5, backup to v5. Updated PDF report to include independent logs and severity formatting. |
| 2026-05-10 | Integrated Titration Wizard: global toggle with medical disclaimer, configurable severe threshold, per-medication protocol management. Log Dose UI optimized for readability: Date/Time moved under medication, Side Effects moved under injection sites. Recommended dosage highlighting with ZAP icon. Interactive titration charts (Spider, Gauges, Timeline) added to Medication Chart tab with rotate functionality. Analytics improved with log-derived dose start dates, 4-week weight lookback, and 0% readiness triggers for missing logs. Added `TitrationWizard.tsx`, `TitrationDecisionChart.tsx`, and `titrationAnalytics.ts`. |
| 2026-05-12 | Implemented robust Data Migration Engine for backups. Decoupled `BACKUP_VERSION` from DB schema. Added versioned migration pipeline (v1→v6), structural validation on import, and `appVersion` metadata in exports. Fixed UI bug where `symptomLogStore` and `protocolStore` were not reloaded after data restoration. Injected `VITE_APP_VERSION` from `package.json` into the app environment. |
