import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationIncidentPath } from './links';

export function useNotificationObserver() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const path = notificationIncidentPath(notification.request.content.data?.url);
      if (path) {
        router.navigate(path);
      }
    }

    try {
      const response = Notifications.getLastNotificationResponse();
      if (response?.notification) {
        redirect(response.notification);
        Notifications.clearLastNotificationResponse();
      }
    } catch {
      // Notifications may be unavailable on a non-native target; normal URL links still work.
    }

    let subscription: ReturnType<
      typeof Notifications.addNotificationResponseReceivedListener
    > | null = null;

    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        redirect(response.notification);
      });
    } catch {
      // Keep URL routing available even when the notifications module is unavailable.
    }

    return () => subscription?.remove();
  }, []);
}
