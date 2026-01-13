// Local notifications helpers (Expo)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Request permission; returns 'granted' | 'denied' | 'undetermined'
export async function requestNotifPermission() {
  // Notifications permissions are not supported on web; avoid warning by no-op
  if (Platform.OS === 'web') {
    return 'denied' as const;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// Schedule daily reminders (default times: 07:30, 12:00, 18:00)
export async function scheduleDailyDragonReminders() {
  // Notifications APIs are not available on web; safely no-op
  if (Platform.OS === 'web') {
    return;
  }
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
      trigger: { type: 'calendar', hour: t.hour, minute: t.minute, repeats: true },
    });
  }
}

// Initialize channels (Android) and reschedule if already granted
export async function initNotificationsIfAllowed() {
  // Skip notifications setup entirely on web
  if (Platform.OS === 'web') {
    return;
  }
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
