import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  addNotificationListeners,
  registerForPushNotifications,
  PushRegistrationResult,
  PushRegistrationStatus,
} from '../services/notifications';

interface NotificationsContextValue {
  status: PushRegistrationStatus;
  message: string | null;
  token: string | null;
  registering: boolean;
  registerNow: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<PushRegistrationStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const applyResult = useCallback((result: PushRegistrationResult) => {
    setStatus(result.status);
    setMessage(result.message);
    setToken(result.token ?? null);
  }, []);

  const registerNow = useCallback(async () => {
    if (!profile) return;

    setRegistering(true);
    try {
      const result = await registerForPushNotifications({
        id: profile.id,
        company_id: profile.company_id,
      });
      applyResult(result);
    } finally {
      setRegistering(false);
    }
  }, [applyResult, profile]);

  useEffect(() => {
    const unsubscribe = addNotificationListeners();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!profile) {
      setStatus('idle');
      setMessage(null);
      setToken(null);
      return;
    }

    registerNow();
  }, [profile?.id, registerNow]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      status,
      message,
      token,
      registering,
      registerNow,
    }),
    [status, message, token, registering, registerNow]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function usePushNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('usePushNotifications deve ser usado dentro de NotificationsProvider');
  }
  return context;
}
