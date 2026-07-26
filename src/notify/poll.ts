import * as Notifications from 'expo-notifications';
import { apiClient } from '@/api/client';
import type { Incident } from '@/api/types';

const POLL_MS = 15000;
let interval: ReturnType<typeof setInterval> | null = null;
let previousUrgentIds = new Set<string>();

export interface NotificationPort {
  notifyIncident(incident: Incident): Promise<void>;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export const expoNotificationPort: NotificationPort = {
  async notifyIncident(incident) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${incident.severity}: ${incident.title}`,
        body: incident.summary,
        data: { url: `/incident/${incident.id}` }
      },
      trigger: null
    });
  }
};

async function pollOnce(token: string | null, port: NotificationPort) {
  const response = await apiClient.listIncidents({ sort: 'severity', order: 'desc' }, token);
  const urgent = response.items.filter((incident) => incident.severity === 'Critical' || incident.severity === 'High');
  const nextIds = new Set(urgent.map((incident) => incident.id));

  for (const incident of urgent) {
    if (!previousUrgentIds.has(incident.id)) {
      await port.notifyIncident(incident);
    }
  }

  previousUrgentIds = nextIds;
}

export function startIncidentPolling(token: string | null, port: NotificationPort = expoNotificationPort) {
  if (interval) {
    clearInterval(interval);
  }

  pollOnce(token, port).catch(() => undefined);
  interval = setInterval(() => {
    pollOnce(token, port).catch(() => undefined);
  }, POLL_MS);

  return () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}
