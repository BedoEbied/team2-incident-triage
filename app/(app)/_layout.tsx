import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';

export default function AppLayout() {
  const { token } = useAuth();

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
