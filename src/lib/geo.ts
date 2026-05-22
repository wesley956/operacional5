// ============================================================
// OPERACIONAL5 — Geofence, GPS e Detecção de Mock Location
// ============================================================

/**
 * Calcula distância entre dois pontos GPS usando a fórmula de Haversine.
 * Retorna distância em metros.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Verifica se um ponto GPS está dentro do raio de um posto.
 */
export function isWithinGeofence(
  lat: number, lng: number,
  postLat: number, postLng: number,
  radiusMeters: number
): boolean {
  return haversineDistance(lat, lng, postLat, postLng) <= radiusMeters;
}

/**
 * Verificação completa de geofence com qualidade de sinal GPS.
 */
export interface GeoCheckResult {
  within_fence: boolean;
  distance_meters: number;
  accuracy_ok: boolean;
  mock_detected: boolean;
  mock_reasons: string[];
  recommendation: 'approve' | 'pending_review' | 'reject' | 'use_qr_fallback';
}

export function checkGeofence(
  lat: number, lng: number,
  postLat: number, postLng: number,
  radiusMeters: number,
  accuracy?: number,
  speed?: number | null,
  altitude?: number | null
): GeoCheckResult {
  const distance = haversineDistance(lat, lng, postLat, postLng);
  const within_fence = distance <= radiusMeters;
  const accuracy_ok = !accuracy || accuracy <= 50;

  const mock = detectMockLocation(accuracy ?? 999, speed ?? null, altitude ?? null);

  let recommendation: GeoCheckResult['recommendation'] = 'approve';
  if (mock.isMock) {
    recommendation = 'reject';
  } else if (!within_fence) {
    recommendation = 'reject';
  } else if (!accuracy_ok) {
    recommendation = 'use_qr_fallback';
  }

  return {
    within_fence,
    distance_meters: Math.round(distance * 100) / 100,
    accuracy_ok,
    mock_detected: mock.isMock,
    mock_reasons: mock.reasons,
    recommendation,
  };
}

/**
 * Detecção básica de GPS falso / mock location.
 * Não é à prova de tudo, mas detecta casos comuns.
 */
export function detectMockLocation(
  accuracy: number,
  speed: number | null,
  altitude: number | null
): { isMock: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];

  // Acurácia suspeita (muito alta ou perfeita demais)
  if (accuracy > 150) {
    reasons.push('Acurácia muito baixa (>150m)');
  }
  if (accuracy < 3 && accuracy > 0) {
    reasons.push('Acurácia suspeita (<3m) — possível emulador');
  }

  // Velocidade zero com acurácia perfeita
  if (speed !== null && speed === 0 && accuracy < 5) {
    reasons.push('Velocidade zero com acurácia perfeita');
  }

  // Altitude sempre zero (comum em mocks)
  if (altitude !== null && altitude === 0) {
    reasons.push('Altitude zero — possível emulador');
  }

  // Velocidade irrealista
  if (speed !== null && speed > 200) {
    reasons.push('Velocidade irrealista');
  }

  const confidence = Math.min(reasons.length / 3, 1);
  const isMock = reasons.length >= 2;

  return { isMock, confidence, reasons };
}

/**
 * Formata distância para exibição humana.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Coordenadas de referência para São Paulo (usado em demo).
 */
export const SAO_PAULO_CENTER = { lat: -23.5505, lng: -46.6333 };
