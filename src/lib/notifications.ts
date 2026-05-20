import type { Medication, Dose } from '../types';
import { getNextDoseTime } from './halfLifeEngine';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function scheduleReminder(
  medication: Medication,
  doses: Dose[]
): { id: string; fireTime: number } | null {
  const nextDose = getNextDoseTime(medication, doses);
  if (!nextDose) return null;

  const reminderTime =
    nextDose.getTime() - medication.reminderHoursBefore * 60 * 60 * 1000;
  const now = Date.now();

  if (reminderTime <= now) return null;

  const id = `reminder-${medication.id}-${nextDose.getTime()}`;

  // Store in localStorage for persistence across sessions
  const reminders = JSON.parse(localStorage.getItem('pepty-reminders') || '[]');
  reminders.push({
    id,
    medicationId: medication.id,
    medicationName: medication.name,
    dosage: medication.dosageOptions[0],
    unit: medication.unit,
    fireTime: reminderTime,
  });
  localStorage.setItem('pepty-reminders', JSON.stringify(reminders));

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
