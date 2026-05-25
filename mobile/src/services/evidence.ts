import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface EvidenceAsset {
  uri: string;
  fileName: string;
  mimeType: string;
}

function guessExtension(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

function makeEvidencePath(companyId: string, prefix: string, mimeType: string) {
  const extension = guessExtension(mimeType);
  const date = new Date().toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 10);
  return `${companyId}/${prefix}/${date}/${Date.now()}-${random}.${extension}`;
}

export async function requestCameraPermission() {
  const result = await ImagePicker.requestCameraPermissionsAsync();
  if (!result.granted) {
    throw new Error('Permissão de câmera negada. Libere a câmera para anexar evidências.');
  }
}

export async function captureEvidencePhoto(): Promise<EvidenceAsset | null> {
  await requestCameraPermission();

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.72,
    base64: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `evidence.${guessExtension(mimeType)}`,
    mimeType,
  };
}

export async function pickEvidenceFromLibrary(): Promise<EvidenceAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permissão de galeria negada.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    quality: 0.72,
    base64: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `evidence.${guessExtension(mimeType)}`,
    mimeType,
  };
}

async function assetToBody(asset: EvidenceAsset): Promise<Blob | ArrayBuffer> {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Não foi possível ler a foto selecionada.');

  if (Platform.OS === 'web') {
    return response.blob();
  }

  return response.blob();
}

export async function uploadEvidencePhoto(params: {
  companyId: string;
  asset: EvidenceAsset;
  prefix: 'presence' | 'occurrence' | 'ronda';
}): Promise<string> {
  const path = makeEvidencePath(params.companyId, params.prefix, params.asset.mimeType);
  const body = await assetToBody(params.asset);

  const { error } = await supabase.storage.from('evidence').upload(path, body, {
    contentType: params.asset.mimeType,
    upsert: false,
  });

  if (error) throw error;
  return path;
}
