import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type PushRegistrationStatus =
  | 'idle'
  | 'unsupported'
  | 'permission_denied'
  | 'missing_project_id'
  | 'registered'
  | 'failed';

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  token?: string;
  message: string;
}

export interface PushProfile {
  id: string;
  company_id: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function getPlatformForDb() {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export async function registerForPushNotifications(profile: PushProfile): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported',
      message: 'Push remoto não é registrado no navegador. Use um aparelho físico.',
    };
  }

  if (!Device.isDevice) {
    return {
      status: 'unsupported',
      message: 'Push remoto exige aparelho físico.',
    };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('operacional-alerts', {
        name: 'Alertas Operacionais',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
        sound: 'default',
      });
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermission.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return {
        status: 'permission_denied',
        message: 'Permissão de notificações negada.',
      };
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      return {
        status: 'missing_project_id',
        message: 'EAS projectId não configurado. Rode eas init ou configure expo.extra.eas.projectId.',
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        {
          user_id: profile.id,
          company_id: profile.company_id,
          token,
          platform: getPlatformForDb(),
          token_type: 'expo',
          active: true,
          last_used_at: new Date().toISOString(),
          app_version: Constants.expoConfig?.version ?? null,
          device_name: Device.deviceName ?? `${Device.manufacturer ?? 'Device'} ${Device.modelName ?? ''}`.trim(),
        },
        { onConflict: 'user_id,platform' }
      );

    if (error) throw error;

    return {
      status: 'registered',
      token,
      message: 'Notificações registradas neste aparelho.',
    };
  } catch (err) {
    return {
      status: 'failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function addNotificationListeners(params?: {
  onReceive?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}) {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    params?.onReceive?.(notification);
  });

  const responded = Notifications.addNotificationResponseReceivedListener((response) => {
    params?.onResponse?.(response);
  });

  return () => {
    received.remove();
    responded.remove();
  };
}
