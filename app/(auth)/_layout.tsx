import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';

export default function AuthLayout() {
  const { isRestoring, token } = useAuth();

  if (isRestoring) {
    return null;
  }

  if (token) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
