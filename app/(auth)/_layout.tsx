import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';

export default function AuthLayout() {
  const { token } = useAuth();

  if (token) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
