import * as Location from 'expo-location';

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  isMock: boolean;
  timestamp: number;
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(
  lat: number, lng: number,
  postLat: number, postLng: number,
  radiusMeters: number
): boolean {
  return haversineDistance(lat, lng, postLat, postLng) <= radiusMeters;
}

export function detectMock(accuracy: number, speed: number | null, altitude: number | null): boolean {
  const reasons: string[] = [];
  if (accuracy > 150) reasons.push('Acurácia muito baixa');
  if (accuracy < 3 && accuracy > 0) reasons.push('Acurácia suspeita');
  if (speed === 0 && accuracy < 5) reasons.push('Velocidade zero perfeita');
  if (altitude === 0) reasons.push('Altitude zero');
  return reasons.length >= 2;
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Permissão de localização negada. Ative o GPS para usar o app.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const mocked = Boolean((position as { mocked?: boolean }).mocked);
  const accuracy = position.coords.accuracy ?? 999;
  const speed = position.coords.speed ?? null;
  const altitude = position.coords.altitude ?? null;

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy,
    speed,
    altitude,
    isMock: mocked || detectMock(accuracy, speed, altitude),
    timestamp: position.timestamp,
  };
}
