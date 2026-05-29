import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export interface HandoverPhotoResult { localUri: string; publicUrl: string; }
export interface HandoverLocationResult { gps_lat: number | null; gps_lng: number | null; gps_valid: boolean; accuracy: number | null; }

export async function captureAndUploadHandoverPhoto(params: { companyId: string; employeeId: string; }): Promise<HandoverPhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Permissão da câmera negada.');
  const result = await ImagePicker.launchCameraAsync({ quality: 0.72, allowsEditing: false, base64: false, exif: false });
  if (result.canceled || !result.assets[0]?.uri) throw new Error('Foto não capturada.');
  const localUri = result.assets[0].uri;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const filePath = `${params.companyId}/handover/${params.employeeId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('evidence').getPublicUrl(filePath);
  return { localUri, publicUrl: data.publicUrl };
}

export async function getHandoverLocation(): Promise<HandoverLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { gps_lat: null, gps_lng: null, gps_valid: false, accuracy: null };
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { gps_lat: position.coords.latitude, gps_lng: position.coords.longitude, gps_valid: true, accuracy: position.coords.accuracy ?? null };
}
