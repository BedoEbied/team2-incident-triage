import { useLocalSearchParams } from 'expo-router';
import { IncidentDetailScreen } from '@/features/incidents/IncidentDetailScreen';
import { routeParam } from '@/navigation/links';

export default function IncidentRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <IncidentDetailScreen id={routeParam(id)} />;
}
