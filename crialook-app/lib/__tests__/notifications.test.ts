import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted lifts the bag above vi.mock's hoisted position so the factory
// can read it. (vi.mock factories are evaluated BEFORE module-top imports.)
const mocks = vi.hoisted(() => ({
  isDevice: { value: true },
  notificationsApi: {
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    setNotificationChannelAsync: vi.fn(),
    getExpoPushTokenAsync: vi.fn(),
    addNotificationResponseReceivedListener: vi.fn(),
    getLastNotificationResponseAsync: vi.fn(),
    scheduleNotificationAsync: vi.fn(),
    cancelScheduledNotificationAsync: vi.fn(),
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  },
}));

vi.mock('expo-device', () => ({
  get isDevice() {
    return mocks.isDevice.value;
  },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'proj-test' } } } },
}));

vi.mock('expo-notifications', () => mocks.notificationsApi);

const notificationsApi = mocks.notificationsApi;
const isDeviceMock = mocks.isDevice;

import {
  cancelScheduledNotification,
  getLastNotificationResponseAsync,
  registerForPushNotifications,
  scheduleCampaignReadyNotification,
} from '../notifications';

beforeEach(() => {
  isDeviceMock.value = true;
  for (const fn of Object.values(notificationsApi)) {
    if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
  }
  process.env.EXPO_OS = 'android';
});

describe('registerForPushNotifications', () => {
  it('returns null on simulator (Device.isDevice = false)', async () => {
    isDeviceMock.value = false;
    expect(await registerForPushNotifications()).toBeNull();
  });

  it('returns null when permission denied after request', async () => {
    notificationsApi.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    notificationsApi.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await registerForPushNotifications()).toBeNull();
  });

  it('returns expo push token when granted (Android sets channels)', async () => {
    notificationsApi.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    notificationsApi.getExpoPushTokenAsync.mockResolvedValueOnce({ data: 'ExponentPushToken[abc]' });
    const r = await registerForPushNotifications();
    expect(r).toBe('ExponentPushToken[abc]');
    expect(notificationsApi.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'CriaLook' }),
    );
    expect(notificationsApi.setNotificationChannelAsync).toHaveBeenCalledWith(
      'campaigns',
      expect.objectContaining({ name: 'Campanhas prontas' }),
    );
  });

  it('skips Android channel setup when EXPO_OS is not android', async () => {
    process.env.EXPO_OS = 'ios'; // legacy guard — repo is Android-only but lib still branches
    notificationsApi.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    notificationsApi.getExpoPushTokenAsync.mockResolvedValueOnce({ data: 'tok' });
    await registerForPushNotifications();
    expect(notificationsApi.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('getLastNotificationResponseAsync', () => {
  it('returns the value when API succeeds', async () => {
    notificationsApi.getLastNotificationResponseAsync.mockResolvedValueOnce({ id: 'r1' });
    expect(await getLastNotificationResponseAsync()).toEqual({ id: 'r1' });
  });
  it('swallows errors and returns null', async () => {
    notificationsApi.getLastNotificationResponseAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await getLastNotificationResponseAsync()).toBeNull();
  });
});

describe('scheduleCampaignReadyNotification', () => {
  it('returns scheduled id on success', async () => {
    notificationsApi.scheduleNotificationAsync.mockResolvedValueOnce('scheduled-1');
    const r = await scheduleCampaignReadyNotification('camp-1');
    expect(r).toBe('scheduled-1');
    const arg = notificationsApi.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.data.campaignId).toBe('camp-1');
    // Default seconds 95 should be honored (>= 5)
    expect(arg.trigger.seconds).toBe(95);
  });
  it('clamps estimatedSeconds floor to 5', async () => {
    notificationsApi.scheduleNotificationAsync.mockResolvedValueOnce('id-2');
    await scheduleCampaignReadyNotification('camp-2', 0);
    const arg = notificationsApi.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.trigger.seconds).toBe(5);
  });
  it('returns null when scheduling throws', async () => {
    notificationsApi.scheduleNotificationAsync.mockRejectedValueOnce(new Error('limit'));
    expect(await scheduleCampaignReadyNotification('c')).toBeNull();
  });
});

describe('cancelScheduledNotification', () => {
  it('no-ops on null id', async () => {
    await cancelScheduledNotification(null);
    expect(notificationsApi.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
  it('forwards id to API', async () => {
    notificationsApi.cancelScheduledNotificationAsync.mockResolvedValueOnce(undefined);
    await cancelScheduledNotification('abc');
    expect(notificationsApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith('abc');
  });
  it('swallows errors', async () => {
    notificationsApi.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('gone'));
    await expect(cancelScheduledNotification('abc')).resolves.toBeUndefined();
  });
});
