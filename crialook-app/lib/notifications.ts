import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CriaLook',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D946EF',
    });
    await Notifications.setNotificationChannelAsync('campaigns', {
      name: 'Campanhas prontas',
      description: 'Avisos quando suas campanhas terminam de gerar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#D946EF',
      sound: 'default',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });

  return token.data;
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Schedule a local "campaign ready" notification as a fallback. The backend
 * also fires a push when the job completes; the local one is a safety net
 * for cases where the user backgrounded the app and the push was delayed.
 *
 * Returns the scheduled notification id (use it to cancel when the polling
 * detects completion before the timer fires).
 */
export async function scheduleCampaignReadyNotification(
  campaignId: string,
  estimatedSeconds: number = 95,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Campanha pronta! 🎉',
        body: 'Suas fotos estão prontas. Toque pra ver.',
        data: { campaignId },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'campaigns' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(estimatedSeconds, 5),
      },
    });
    return id;
  } catch {
    return null;
  }
}

/** Cancels a previously scheduled local notification. Idempotent. */
export async function cancelScheduledNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* idempotent */
  }
}
