// ============================================================
// OPERACIONAL5 Mobile — Location Service
// ============================================================

/**
 * Em produção: usa expo-location para GPS real.
 * Esta é a interface que as screens usam.
 */

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  isMock: boolean;
  timestamp: number;
}

/**
 * Haversine distance entre dois pontos GPS.
 * Usado no mobile para validação offline.
 */
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

/**
 * Verifica se o operador está dentro do raio do posto.
 */
export function isWithinGeofence(
  lat: number, lng: number,
  postLat: number, postLng: number,
  radiusMeters: number
): boolean {
  return haversineDistance(lat, lng, postLat, postLng) <= radiusMeters;
}

/**
 * Detecção básica de mock location.
 */
export function detectMock(accuracy: number, speed: number | null, altitude: number | null): boolean {
  const reasons: string[] = [];
  if (accuracy > 150) reasons.push('Acurácia muito baixa');
  if (accuracy < 3 && accuracy > 0) reasons.push('Acurácia suspeita');
  if (speed === 0 && accuracy < 5) reasons.push('Velocidade zero perfeita');
  if (altitude === 0) reasons.push('Altitude zero');
  return reasons.length >= 2;
}
