import type { Medication, Dose } from '../types';
import { getNextDoseTime } from './halfLifeEngine';
import { useSettingsStore } from '../stores/settingsStore';
import { useProtocolStore } from '../stores/protocolStore';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function scheduleReminder(
  medication: Medication,
  doses: Dose[]
): { id: string; fireTime: number } | null {
  if (!medication.enabled) return null;

  const nextDose = getNextDoseTime(medication, doses);
  if (!nextDose) return null;

  const reminderTime =
    nextDose.getTime() - medication.reminderHoursBefore * 60 * 60 * 1000;
  const now = Date.now();

  if (reminderTime <= now) return null;

  const id = `reminder-${medication.id}-${nextDose.getTime()}`;

  // Determine dosage based on protocol or last dose
  let dosage = medication.dosageOptions[0];
  const medDoses = doses
    .filter((d) => d.medicationId === medication.id)
    .sort((a, b) => b.dateTime - a.dateTime);

  const settings = useSettingsStore.getState().settings;
  const titrationEnabled = settings?.titrationWizardEnabled ?? false;
  let protocolDose: number | undefined;

  if (titrationEnabled) {
    const protocol = useProtocolStore.getState().protocols.find((p) => p.medicationId === medication.id);
    if (protocol) {
      const currentStep = protocol.steps[protocol.currentStepIndex];
      if (currentStep) {
        protocolDose = currentStep.dosage;
      }
    }
  }

  if (protocolDose !== undefined) {
    dosage = protocolDose;
  } else if (medDoses.length > 0) {
    dosage = medDoses[0].dosage;
  }

  // Store in localStorage for persistence across sessions, deduplicating previous reminders for this medication
  const reminders = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
  const filteredReminders = reminders.filter(
    (r: { medicationId: string }) => r.medicationId !== medication.id
  );
  filteredReminders.push({
    id,
    medicationId: medication.id,
    medicationName: medication.name,
    dosage,
    unit: medication.unit,
    fireTime: reminderTime,
  });
  localStorage.setItem('pepty-reminders', JSON.stringify(filteredReminders));

  return { id, fireTime: reminderTime };
}

export async function checkAndFireReminders(): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const now = Date.now();
  const reminders = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
  const remaining: typeof reminders = [];

  for (const reminder of reminders) {
    if (reminder.fireTime <= now) {
      const title = 'PeptyTrack Reminder';
      const options = {
        body: `Time for your ${reminder.medicationName} ${reminder.dosage}${reminder.unit} dose!`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: reminder.id,
        requireInteraction: true,
      };

      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, options);
        } else {
          new Notification(title, options as NotificationOptions);
        }
      } catch (e) {
        console.error('Failed to show notification:', e);
      }
    } else {
      remaining.push(reminder);
    }
  }

  localStorage.setItem('pepty-reminders', JSON.stringify(remaining));
}

export function clearRemindersForMedication(medicationId: string): void {
  const reminders = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
  const filtered = reminders.filter(
    (r: { medicationId: string }) => r.medicationId !== medicationId
  );
  localStorage.setItem('pepty-reminders', JSON.stringify(filtered));
}

export function rescheduleAllReminders(
  medications: Medication[],
  doses: Dose[]
): void {
  localStorage.setItem('pepty-reminders', '[]');
  for (const med of medications) {
    scheduleReminder(med, doses);
  }
}
