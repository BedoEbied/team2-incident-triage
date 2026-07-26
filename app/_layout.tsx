import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { paperTheme } from '@/theme/paperTheme';
import { FONT_ASSETS } from '@/theme/fonts';
import { tokenStorage } from '@/storage/token';
import { AuthProvider } from '@/features/auth/AuthContext';
import { useNotificationObserver } from '@/navigation/useNotificationObserver';

const queryClient = new QueryClient();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const theme = useMemo(() => paperTheme(scheme, fontsLoaded), [fontsLoaded, scheme]);

  useNotificationObserver();

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <AuthProvider storage={tokenStorage}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
