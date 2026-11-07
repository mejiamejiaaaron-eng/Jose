import * as mm from 'music-metadata-browser';
import { uploadCoverToR2 } from './r2Client';

// Portada por defecto de alta fidelidad para canciones sin portada en iTunes
export const DEFAULT_SONG_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

// Catálogo de portadas de alta fidelidad por género musical
export const GENRE_COVERS: Record<string, string> = {
  'Corridos': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
  'Corridos Tumbados': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
  'Banda': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
  'Regional Mexicano': 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
  'Reggaeton': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
  'Pop': 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
  'Rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
  'Salsa': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
  'Bachata': 'https://images.unsplash.com/photo-1445985543470-41fdd5c31447?w=600&auto=format&fit=crop&q=80',
  'Cumbia': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
  'Merengue': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
  'Baladas Románticas': 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
  'Música Cristiana': 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=600&auto=format&fit=crop&q=80',
  'Trap': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
  'Hip Hop': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
  'Rap': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
  'Electrónica': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
  'Sin Categoría': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
  'Otros': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
};

/**
 * 1. Corrección de Encoding UTF-8:
 * Corrige problemas de mojibake (caracteres mal decodificados como 'MÃºsica' o tildes eliminadas como 'M sica').
 */
export function fixUtf8Encoding(text: string | null | undefined): string {
  if (!text) return '';
  let str = String(text).trim();

  // Eliminar caracteres nulos o de control ilegibles
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Corregir mojibake típico UTF-8 mal interpretado como ISO-8859-1 / Windows-1252
  if (/[\u00C2\u00C3\u00E0-\u00FF]/.test(str)) {
    try {
      const bytes = new Uint8Array(Array.from(str).map((c) => c.charCodeAt(0) & 0xff));
      const recovered = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (recovered && !recovered.includes('\uFFFD') && recovered.length <= str.length) {
        str = recovered;
      }
    } catch (_) {}
  }

  // Corregir palabras en español donde la vocal con tilde fue convertida erróneamente en espacio
  str = str.replace(/\bM\s+sica\b/gi, 'Música');
  str = str.replace(/\bcanci\s+n\b/gi, 'canción');
  str = str.replace(/\bCanci\s+n\b/gi, 'Canción');
  str = str.replace(/\bcoraz\s+n\b/gi, 'corazón');
  str = str.replace(/\bCoraz\s+n\b/gi, 'Corazón');
  str = str.replace(/\bacci\s+n\b/gi, 'acción');
  str = str.replace(/\bAcci\s+n\b/gi, 'Acción');
  str = str.replace(/\b\s*xito\b/gi, 'Éxito');
  str = str.replace(/\bRom\s+ntica\b/gi, 'Romántica');
  str = str.replace(/\brom\s+ntica\b/gi, 'romántica');
  str = str.replace(/\bElectr\s+nica\b/gi, 'Electrónica');
  str = str.replace(/\belectr\s+nica\b/gi, 'electrónica');

  // Normalizar Unicode estándar NFC
  try {
    str = str.normalize('NFC');
  } catch (_) {}

  return str.trim();
}

/**
 * Extrae limpiamente artista y título a partir del nombre del archivo (ej: "Bad Bunny - Tití Me Preguntó.mp3")
 */
export function extractArtistAndTitleFromFilename(fileName: string): { artist: string; title: string } {
  const clean = (fileName || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/_?spotdown(?:\.org)?/gi, '')
    .replace(/^\s*(?:\d+[\s._-]+)+/, '')
    .replace(
      /\b(official\s+video|video\s+oficial|official\s+audio|audio\s+oficial|video\s+lyric|letra|lyrics|en\s+vivo|live|remix|hd|4k|1080p|hq|320kbps|128kbps|y2mate(?:\.is)?|mp3clan|snaptube|full\s+audio)\b/gi,
      ''
    )
    .replace(/[\[\(\{]\s*[\]\)\}]/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let artist = '';
  let title = clean || 'Canción';

  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  } else if (clean.includes(' — ')) {
    const parts = clean.split(' — ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' — ').trim();
  } else if (clean.includes(' – ')) {
    const parts = clean.split(' – ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' – ').trim();
  } else if (clean.toLowerCase().includes(' by ')) {
    const parts = clean.split(/ by /i);
    title = parts[0].trim();
    artist = parts[1].trim();
  }

  return {
    artist: fixUtf8Encoding(artist),
    title: fixUtf8Encoding(title) || 'Canción'
  };
}

/**
 * Filtro de basura para Artista:
 * Si es simplemente 'Música', 'Music', 'Desconocido', etc., lo ignora y devuelve fallback.
 */
export function cleanArtist(rawArtist: string | null | undefined, fallback: string = 'Artista'): string {
  const fixed = fixUtf8Encoding(rawArtist);
  const normalized = fixed.toLowerCase().replace(/[\s._\-]+/g, '');
  if (
    !fixed ||
    normalized === 'musica' ||
    normalized === 'msica' ||
    normalized === 'music' ||
    normalized === 'unknown' ||
    normalized === 'unknownartist' ||
    normalized === 'desconocido' ||
    normalized === 'artistadesconocido'
  ) {
    return fallback;
  }
  return fixed;
}

/**
 * Filtro de basura para Género:
 * Si es simplemente 'Música', 'Music', 'Unknown', etc., devuelve 'Sin Categoría'.
 */
export function cleanGenre(rawGenre: string | null | undefined, fallback: string = 'Sin Categoría'): string {
  const fixed = fixUtf8Encoding(rawGenre);
  // Eliminar números ID3 como "(13)" o "13"
  const stripped = fixed.replace(/^\(\d+\)/, '').trim();
  const normalized = stripped.toLowerCase().replace(/[\s._\-]+/g, '');

  if (
    !stripped ||
    normalized === 'musica' ||
    normalized === 'msica' ||
    normalized === 'music' ||
    normalized === 'unknown' ||
    normalized === 'other' ||
    normalized === 'otros' ||
    normalized === 'none' ||
    normalized === 'general' ||
    normalized === 'audio' ||
    normalized === 'sincategoria'
  ) {
    return fallback;
  }
  return stripped;
}

/**
 * Limpieza de Título con fallback al nombre de archivo limpio
 */
export function cleanTitle(rawTitle: string | null | undefined, fileName: string): string {
  const fixed = fixUtf8Encoding(rawTitle);
  const normalized = fixed.toLowerCase().replace(/[\s._\-]+/g, '');

  if (fixed && normalized !== 'musica' && normalized !== 'msica' && normalized !== 'music' && normalized !== 'audio' && normalized !== 'track') {
    return fixed;
  }

  // Fallback: nombre del archivo sin extensiones ni marcas de rippers
  const parsed = extractArtistAndTitleFromFilename(fileName);
  return parsed.title || 'Canción';
}

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  genre: string;
  embeddedCoverBlob: Blob | null;
  embeddedCoverUrl: string | null;
  lyrics?: string;
}

/**
 * Extracción de metadatos reales de audio (Título, Artista, Género, Carátula, Letras)
 * utilizando music-metadata-browser con soporte nativo de UTF-8 y decodificación ID3.
 */
export async function extractRealAudioMetadata(
  file: File | Blob,
  fileName: string = 'audio.mp3'
): Promise<ExtractedAudioMetadata> {
  const effectiveName = file instanceof File ? file.name : fileName;
  let rawTitle: string | undefined;
  let rawArtist: string | undefined;
  let rawGenre: string | undefined;
  let embeddedCoverBlob: Blob | null = null;
  let embeddedCoverUrl: string | null = null;
  let lyrics: string | undefined;

  try {
    const metadata = await mm.parseBlob(file);
    const common = metadata.common || {};

    if (common.title) rawTitle = common.title;
    if (common.artist) rawArtist = common.artist;
    else if (common.artists && common.artists.length > 0) rawArtist = common.artists.join(', ');

    if (common.genre && common.genre.length > 0) {
      rawGenre = common.genre.join(', ');
    }

    if (common.lyrics && common.lyrics.length > 0) {
      lyrics = common.lyrics.join('\n');
    }

    const picture = mm.selectCover(common.picture);
    if (picture && picture.data && picture.data.length > 0) {
      const u8 = new Uint8Array(picture.data);
      embeddedCoverBlob = new Blob([u8], { type: picture.format || 'image/jpeg' });
      embeddedCoverUrl = URL.createObjectURL(embeddedCoverBlob);
    }
  } catch (err) {
    console.warn('[Metadata] Error con music-metadata-browser, usando fallback:', err);
  }

  // Aplicar extracción inteligente de título y artista si no vienen en ID3
  const fromFilename = extractArtistAndTitleFromFilename(effectiveName);

  let finalTitle = cleanTitle(rawTitle, effectiveName);
  if ((!rawTitle || finalTitle === 'Canción') && fromFilename.title) {
    finalTitle = fromFilename.title;
  }

  let finalArtist = cleanArtist(rawArtist, '');
  if (!finalArtist || finalArtist === 'Artista Desconocido' || finalArtist === 'Desconocido') {
    finalArtist = fromFilename.artist || 'Artista';
  }

  const finalGenre = cleanGenre(rawGenre, 'Sin Categoría');

  return {
    title: finalTitle,
    artist: finalArtist,
    genre: finalGenre,
    embeddedCoverBlob,
    embeddedCoverUrl,
    lyrics,
  };
}

/**
 * 2. Búsqueda Automática de Portadas en Internet (iTunes API):
 * Consulta https://itunes.apple.com/search?term={artista}+{titulo}&entity=song&limit=1
 * Devuelve la URL en alta resolución (600x600) y género si existe.
 */
export async function searchCoverInITunes(
  artist: string,
  title: string
): Promise<{ coverUrl: string; genre?: string; trackName?: string; artistName?: string } | null> {
  const cleanA = artist && artist !== 'Artista Desconocido' ? artist.trim() : '';
  const cleanT = title ? title.trim() : '';

  const searchTerms = [
    cleanA && cleanT ? `${cleanA} ${cleanT}` : cleanT || cleanA,
    cleanT, // intento con solo título si falla la combinación
  ].filter(Boolean);

  for (const term of searchTerms) {
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`;
      const res = await fetch(itunesUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const item = data.results[0];
        if (item.artworkUrl100) {
          // Reemplazar 100x100 por 600x600 en alta resolución
          const highRes = item.artworkUrl100
            .replace(/100x100(bb)?\.(jpg|png|webp)/i, '600x600$1.$2')
            .replace('/100x100', '/600x600');

          return {
            coverUrl: highRes,
            genre: item.primaryGenreName ? fixUtf8Encoding(item.primaryGenreName) : undefined,
            trackName: item.trackName ? fixUtf8Encoding(item.trackName) : undefined,
            artistName: item.artistName ? fixUtf8Encoding(item.artistName) : undefined,
          };
        }
      }
    } catch (e) {
      console.warn(`[iTunes API] Error buscando "${term}":`, e);
    }
  }

  return null;
}

/**
 * Descarga una imagen remota y devuelve su Blob (con fallback por proxy si hay CORS).
 */
export async function downloadImageBlob(imageUrl: string): Promise<Blob> {
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (_) {
    // Si falla por CORS en navegador, utilizar el endpoint proxy del backend
  }

  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  const proxyRes = await fetch(proxyUrl);
  if (!proxyRes.ok) {
    throw new Error(`No se pudo descargar la portada: ${proxyRes.statusText}`);
  }
  return await proxyRes.blob();
}

/**
 * Resuelve la portada de la canción buscando en iTunes, descargándola y subiéndola a Cloudflare R2
 * en la carpeta covers/. Si no se encuentra, usa fallback a R2 o portada por defecto.
 */
export async function resolveCoverAndUploadToR2(
  artist: string,
  title: string,
  embeddedCoverBlob?: Blob | null
): Promise<string> {
  const sanitizedTitle = (title || 'cover').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  // 1. Buscar en iTunes API
  const itunesResult = await searchCoverInITunes(artist, title);

  if (itunesResult && itunesResult.coverUrl) {
    try {
      const blob = await downloadImageBlob(itunesResult.coverUrl);
      const r2Url = await uploadCoverToR2(blob, `${sanitizedTitle}-itunes.jpg`);
      return r2Url;
    } catch (r2Err) {
      console.warn('[Cover] Error subiendo portada de iTunes a R2, usando URL directa de iTunes:', r2Err);
      return itunesResult.coverUrl;
    }
  }

  // 2. Si no se encuentra en iTunes, usar carátula ID3 embebida si existe
  if (embeddedCoverBlob) {
    try {
      const r2Url = await uploadCoverToR2(embeddedCoverBlob, `${sanitizedTitle}-id3.jpg`);
      return r2Url;
    } catch (id3Err) {
      console.warn('[Cover] Error subiendo carátula embebida a R2:', id3Err);
    }
  }

  // 3. Fallback a portada por defecto
  return DEFAULT_SONG_COVER;
}

/**
 * Obtiene la portada representativa para una carpeta de género musical.
 */
export function getGenreCover(genreName: string): string {
  const normalized = cleanGenre(genreName);
  if (GENRE_COVERS[normalized]) {
    return GENRE_COVERS[normalized];
  }
  for (const [k, v] of Object.entries(GENRE_COVERS)) {
    if (normalized.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(normalized.toLowerCase())) {
      return v;
    }
  }
  return DEFAULT_SONG_COVER;
}
