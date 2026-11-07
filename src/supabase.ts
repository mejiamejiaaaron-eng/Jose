import { createClient } from '@supabase/supabase-js';

/**
 * Sanitiza y normaliza la URL de Supabase para evitar errores como:
 * "Invalid path specified in request URL".
 *
 * Requisitos:
 * 1. Debe ser un origen válido (https://[tu-proyecto].supabase.co).
 * 2. NO debe terminar con barra diagonal (/).
 * 3. NO debe incluir rutas hijas como /rest/v1 o /auth/v1.
 * 4. Limpia comillas, espacios en blanco y saltos de línea.
 */
export function cleanSupabaseUrl(rawUrl?: string): string {
  const fallback = 'https://djqjagjaywphhaoonbdq.supabase.co';
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;

  // 1. Eliminar espacios y comillas accidentales
  let cleaned = rawUrl.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!cleaned) return fallback;

  // 2. Garantizar protocolo https://
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }

  // 3. Extraer solo el origen (protocolo + hostname + puerto)
  try {
    const urlObj = new URL(cleaned);
    cleaned = urlObj.origin;
  } catch {
    // Si falla el constructor URL, remover manualmente sufijos de ruta y slash
    cleaned = cleaned.replace(/\/(rest|auth)\/v\d+.*$/i, '');
  }

  // 4. Asegurar estrictamente que no termine con barra diagonal
  cleaned = cleaned.replace(/\/+$/, '');

  return cleaned || fallback;
}

/**
 * Sanitiza la clave anónima (anon key / publishable key) de Supabase
 * eliminando comillas dobles, simples, espacios y saltos de línea.
 */
export function cleanSupabaseKey(rawKey?: string): string {
  const fallback = 'sb_publishable_ksSF0e-Rml3_zgrbccACag_TVw6nhKw';
  if (!rawKey || typeof rawKey !== 'string') return fallback;
  return rawKey.trim().replace(/^['"]+|['"]+$/g, '').trim() || fallback;
}

// Variables de entorno sanitizadas
export const SUPABASE_URL = cleanSupabaseUrl(
  (import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.SUPABASE_URL
);
export const SUPABASE_KEY = cleanSupabaseKey(
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.SUPABASE_ANON_KEY || (import.meta as any).env?.SUPABASE_KEY
);

// Inicialización oficial de Supabase con URL sin barra diagonal
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
