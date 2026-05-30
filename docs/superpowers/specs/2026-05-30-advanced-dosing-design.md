# Advanced Dosing and PK Titration Mode Design

## 1. Overview
PeptyTrack currently supports rigid clinical dosing schedules (daily, twice-daily, weekly, biweekly) and a titration wizard that tracks progression based purely on time spent at a specific weekly dose. 

Advanced users often practice "split dosing" (e.g., injecting every 3 days) to maintain average steady-state circulation while minimizing the difference between peak and trough blood levels, thereby reducing side effects.

This design introduces flexible custom dosing intervals and an advanced Pharmacokinetic (PK) Titration Mode that tracks actual blood concentration rather than nominal weekly doses.

## 2. Data Model Changes

### `src/types.ts`
- **`Frequency` Type:** Expand `'daily' | 'twice-daily' | 'weekly' | 'biweekly'` to include `'custom'`.
- **`Medication` & `MedicationTemplate` Interfaces:** Add `customFrequencyDays?: number` to support arbitrary intervals (e.g., 3, 5).
- **`Protocol` Interface:** Add `targetType: 'weekly-equivalent' | 'steady-state-concentration'`.
- **`ProtocolStep` Interface:** Add optional `targetConcentration?: number`.

## 3. Core Engine Updates

### `lib/halfLifeEngine.ts`
Add pharmacokinetic math to translate between weekly doses and custom intervals:
1. `calculateEquivalentCustomDose(weeklyDose, customDays, halfLife)`: Uses the steady-state formula backwards to find the exact dose required at `customDays` intervals to match the average circulation of `weeklyDose`.
2. `calculateRollingAverageConcentration(medication, doses)`: Computes the 7-day moving average of active ingredient concentration, accounting for missed, early, or erratic doses.

## 4. Titration Analytics

### `lib/titrationAnalytics.ts`
Modify the `evaluateTitration` logic to branch based on the user's selected mode:
- **Weekly Equivalent Mode (Clinical Default):** Evaluates readiness based on time elapsed since the current step started, but abstracts the math so the UI can recommend split equivalents.
- **Steady-State PK Mode (Advanced):** Ignores "time spent on dose amount". Instead, checks if `calculateRollingAverageConcentration` has consistently met the `targetConcentration` for the specified `durationWeeks`. Pauses the progression clock if circulation drops below the target.

## 5. UI Updates

- **Settings (`Settings.tsx` & `settingsStore.ts`):** 
  - Add "Advanced PK Titration Mode" toggle.
- **Medication Editor (`Medications.tsx` / `MedicationModal`):** 
  - If Frequency is set to "Custom", display a number input for "Every X days".
- **Titration Wizard (`TitrationWizard.tsx`):**
  - **Clinical Mode:** "Take 2.14mg every 3 days to match your 5mg weekly step."
  - **PK Mode:** "Current 7-day Average: 7.2mg. Target: 8.5mg. Take Xmg today to maintain."

## 6. Testing Strategy
- Unit tests for `calculateEquivalentCustomDose` to verify mathematically that the steady state matches the standard weekly schedule.
- Unit tests for `calculateRollingAverageConcentration` with simulated chaotic dosing schedules.
- Update `titrationAnalytics.test.ts` to cover both `weekly-equivalent` and `steady-state-concentration` paths.
