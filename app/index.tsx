import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';

export default function Index() {
  const { token } = useAuth();
  return <Redirect href={token ? '/(app)' : '/(auth)/login'} />;
}
