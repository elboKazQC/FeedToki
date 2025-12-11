// Local notifications helpers (Expo)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Request permission; returns 'granted' | 'denied' | 'undetermined'
export async function requestNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// Schedule daily reminders (default times: 07:30, 12:00, 18:00)
export async function scheduleDailyDragonReminders() {
  const triggers = [
    { hour: 7, minute: 30 },
    { hour: 12, minute: 0 },
    { hour: 18, minute: 0 },
  ];

  // Clean before re-creating
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const t of triggers) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FeedToki a faim 🐉',
        body: "Qu'est-ce que tu manges ?",
      },
      trigger: { hour: t.hour, minute: t.minute, repeats: true },
    });
  }
}

// Initialize channels (Android) and reschedule if already granted
export async function initNotificationsIfAllowed() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FeedToki',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    await scheduleDailyDragonReminders();
  }
}
