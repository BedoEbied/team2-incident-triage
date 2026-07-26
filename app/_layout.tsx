import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { paperTheme } from '@/theme/paperTheme';
import { FONT_ASSETS } from '@/theme/fonts';
import { tokenStorage } from '@/storage/token';
import { AuthProvider } from '@/features/auth/AuthContext';

const queryClient = new QueryClient();

function useNotificationObserver() {
  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') {
        router.push(url);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) {
        redirect(response.notification);
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });

    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const theme = useMemo(() => paperTheme(scheme, fontsLoaded), [fontsLoaded, scheme]);
  const [initialToken, setInitialToken] = useState<string | null | undefined>(undefined);

  useNotificationObserver();

  useEffect(() => {
    tokenStorage.getToken().then(setInitialToken);
  }, []);

  if (initialToken === undefined) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <AuthProvider initialToken={initialToken} storage={tokenStorage}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
