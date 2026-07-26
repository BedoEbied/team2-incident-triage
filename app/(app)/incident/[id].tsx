import { useLocalSearchParams } from 'expo-router';
import { IncidentDetailScreen } from '@/features/incidents/IncidentDetailScreen';

export default function IncidentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IncidentDetailScreen id={id} />;
}
