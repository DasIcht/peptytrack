import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  requestNotificationPermission,
  scheduleReminder,
  checkAndFireReminders,
  clearRemindersForMedication,
  rescheduleAllReminders,
} from './notifications';
import type { Medication, Dose } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useProtocolStore } from '../stores/protocolStore';

const TEST_MED: Medication = {
  id: 'test-med-1',
  templateId: 'semaglutide',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25, 0.5, 1],
  unit: 'mg',
  frequency: 'weekly',
  halfLifeHours: 168,
  color: '#14b8a6',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: 0,
};

describe('notifications library', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useSettingsStore.setState({
      settings: {
        weightUnit: 'kg',
        medicationUnit: 'mg',
        notificationsEnabled: true,
        injectionRotationStrategy: 'sequential',
        injectionRotationSites: [],
        titrationWizardEnabled: false,
        severeSideEffectThreshold: 5,
        theme: 'teal-night' as const,
        customAccentColor: null,
      },
      loading: false,
      initialized: true,
    });
    useProtocolStore.setState({
      protocols: [],
      loading: false,
      initialized: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestNotificationPermission', () => {
    it('returns true when permission is granted', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted');
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: mockRequestPermission,
      });

      const result = await requestNotificationPermission();
      expect(result).toBe(true);
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    it('returns false when permission is denied', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('denied');
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: mockRequestPermission,
      });

      const result = await requestNotificationPermission();
      expect(result).toBe(false);
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    it('returns false if Notification is not supported', async () => {
      // Delete from window to simulate lack of support in JSDOM
      const originalNotification = window.Notification;
      // @ts-ignore
      delete window.Notification;

      const result = await requestNotificationPermission();
      expect(result).toBe(false);

      // Restore original
      window.Notification = originalNotification;
    });
  });

  describe('scheduleReminder', () => {
    it('schedules a reminder based on the next dose time', () => {
      const now = Date.now();
      // A weekly med with a dose taken 1 day ago has its next dose in 6 days (144 hours).
      // reminderHoursBefore is 24, so reminder is scheduled 5 days from now.
      const lastDose: Dose = {
        id: 'd1',
        medicationId: 'test-med-1',
        dosage: 0.25,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      const reminder = scheduleReminder(TEST_MED, [lastDose]);
      expect(reminder).not.toBeNull();
      expect(reminder!.id).toContain(`reminder-${TEST_MED.id}`);

      const expectedTime = now + 5 * 24 * 60 * 60 * 1000;
      expect(reminder!.fireTime).toBeCloseTo(expectedTime, -3); // close to nearest second

      // Check localStorage persistence
      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].medicationId).toBe(TEST_MED.id);
    });

    it('returns null if no next dose is scheduled', () => {
      const reminder = scheduleReminder(TEST_MED, []);
      expect(reminder).toBeNull();
    });

    it('returns null if medication is disabled', () => {
      const disabledMed = { ...TEST_MED, enabled: false };
      const lastDose: Dose = {
        id: 'd1',
        medicationId: TEST_MED.id,
        dosage: 0.25,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: Date.now() - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      const reminder = scheduleReminder(disabledMed, [lastDose]);
      expect(reminder).toBeNull();
    });

    it('schedules reminder with dosage of last logged dose when titration is disabled', () => {
      const now = Date.now();
      const lastDose: Dose = {
        id: 'd1',
        medicationId: TEST_MED.id,
        dosage: 0.5, // Different from starting dose (0.25)
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      const reminder = scheduleReminder(TEST_MED, [lastDose]);
      expect(reminder).not.toBeNull();
      
      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].dosage).toBe(0.5);
    });

    it('schedules reminder with active protocol step dosage when titration is enabled', () => {
      const now = Date.now();
      useSettingsStore.setState({
        settings: {
          weightUnit: 'kg',
          medicationUnit: 'mg',
          notificationsEnabled: true,
          injectionRotationStrategy: 'sequential',
          injectionRotationSites: [],
          titrationWizardEnabled: true,
          severeSideEffectThreshold: 5,
          theme: 'teal-night' as const,
          customAccentColor: null,
        }
      });
      useProtocolStore.setState({
        protocols: [{
          id: 'proto-1',
          medicationId: TEST_MED.id,
          name: 'Protocol 1',
          targetType: 'weekly-equivalent',
          steps: [
            { id: 's1', dosage: 0.25, durationWeeks: 4 },
            { id: 's2', dosage: 1.0, durationWeeks: 4 }, // current step dosage
          ],
          currentStepIndex: 1,
          startDate: now,
          currentStepStartDate: now,
          autoAdvance: true,
          createdAt: now,
        }]
      });

      const lastDose: Dose = {
        id: 'd1',
        medicationId: TEST_MED.id,
        dosage: 0.25,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      const reminder = scheduleReminder(TEST_MED, [lastDose]);
      expect(reminder).not.toBeNull();

      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].dosage).toBe(1.0); // titration step dosage
    });

    it('deduplicates previous reminders for the same medication', () => {
      const now = Date.now();
      // Setup existing reminders, including one duplicate for TEST_MED.id
      localStorage.setItem('pepty-reminders', JSON.stringify([
        { id: `reminder-${TEST_MED.id}-old`, medicationId: TEST_MED.id, dosage: 0.25, fireTime: 100 },
        { id: `reminder-other`, medicationId: 'other-med', dosage: 1.5, fireTime: 200 }
      ]));

      const lastDose: Dose = {
        id: 'd1',
        medicationId: TEST_MED.id,
        dosage: 0.5,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      const reminder = scheduleReminder(TEST_MED, [lastDose]);
      expect(reminder).not.toBeNull();

      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(2); // One other med, one new TEST_MED (old TEST_MED is removed)
      const testMedReminders = stored.filter((r: any) => r.medicationId === TEST_MED.id);
      expect(testMedReminders.length).toBe(1);
      expect(testMedReminders[0].id).toContain(`reminder-${TEST_MED.id}`);
    });
  });

  describe('clearRemindersForMedication', () => {
    it('removes only the reminders for the specified medication ID', () => {
      const reminders = [
        { id: 'rem-1', medicationId: 'test-med-1', fireTime: 100 },
        { id: 'rem-2', medicationId: 'test-med-2', fireTime: 200 },
      ];
      localStorage.setItem('pepty-reminders', JSON.stringify(reminders));

      clearRemindersForMedication('test-med-1');

      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].medicationId).toBe('test-med-2');
    });
  });

  describe('rescheduleAllReminders', () => {
    it('clears all reminders and schedules new ones for all medications', () => {
      const now = Date.now();
      const lastDose: Dose = {
        id: 'd1',
        medicationId: 'test-med-1',
        dosage: 0.25,
        unit: 'mg',
        injectionSite: 'abdomen-upper-left',
        dateTime: now - 24 * 60 * 60 * 1000,
        notes: '',
        createdAt: 0,
      };

      localStorage.setItem('pepty-reminders', JSON.stringify([{ id: 'old-reminder', medicationId: 'other-med' }]));

      rescheduleAllReminders([TEST_MED], [lastDose]);

      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].medicationId).toBe(TEST_MED.id);
      expect(stored[0].id).not.toBe('old-reminder');
    });
  });

  describe('checkAndFireReminders', () => {
    it('uses service worker showNotification when available', async () => {
      const now = Date.now();
      const reminders = [
        {
          id: 'rem-sw-1',
          medicationId: 'test-med-1',
          medicationName: 'Semaglutide',
          dosage: 0.25,
          unit: 'mg',
          fireTime: now - 1000, // triggered in the past
        },
      ];
      localStorage.setItem('pepty-reminders', JSON.stringify(reminders));

      const mockShowNotification = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('Notification', {
        permission: 'granted',
      });
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: mockShowNotification,
          }),
        },
      });

      await checkAndFireReminders();

      expect(mockShowNotification).toHaveBeenCalledWith(
        'PeptyTrack Reminder',
        expect.objectContaining({
          body: 'Time for your Semaglutide 0.25mg dose!',
          tag: 'rem-sw-1',
        })
      );

      // Reminder should be cleared from localStorage since it was fired
      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(0);
    });

    it('falls back to legacy constructor when service worker is not available', async () => {
      const now = Date.now();
      const reminders = [
        {
          id: 'rem-legacy-1',
          medicationId: 'test-med-1',
          medicationName: 'Semaglutide',
          dosage: 0.25,
          unit: 'mg',
          fireTime: now - 1000,
        },
      ];
      localStorage.setItem('pepty-reminders', JSON.stringify(reminders));

      const mockNotificationConstructor = vi.fn();
      mockNotificationConstructor.prototype = {};
      const mockNotificationGlobal = Object.assign(mockNotificationConstructor, {
        permission: 'granted',
      });

      vi.stubGlobal('Notification', mockNotificationGlobal);
      vi.stubGlobal('navigator', {}); // serviceWorker is undefined

      await checkAndFireReminders();

      expect(mockNotificationConstructor).toHaveBeenCalledWith(
        'PeptyTrack Reminder',
        expect.objectContaining({
          body: 'Time for your Semaglutide 0.25mg dose!',
          tag: 'rem-legacy-1',
        })
      );

      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(0);
    });

    it('does not fire reminders scheduled in the future', async () => {
      const now = Date.now();
      const reminders = [
        {
          id: 'rem-future',
          medicationId: 'test-med-1',
          medicationName: 'Semaglutide',
          dosage: 0.25,
          unit: 'mg',
          fireTime: now + 10000, // future
        },
      ];
      localStorage.setItem('pepty-reminders', JSON.stringify(reminders));

      const mockShowNotification = vi.fn();
      vi.stubGlobal('Notification', {
        permission: 'granted',
      });
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: mockShowNotification,
          }),
        },
      });

      await checkAndFireReminders();

      expect(mockShowNotification).not.toHaveBeenCalled();

      // Reminder should still be in localStorage
      const stored = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe('rem-future');
    });
  });
});
