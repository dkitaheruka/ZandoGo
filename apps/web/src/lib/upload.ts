import { api } from './api';

export type UploadPurpose =
  | 'KYC_DOCUMENT'
  | 'PRODUCT_IMAGE'
  | 'PRODUCT_VIDEO'
  | 'CHAT_IMAGE'
  | 'DISPUTE_EVIDENCE'
  | 'DELIVERY_PROOF';

const ACCEPTED: Record<
  UploadPurpose,
  { types: string[]; label: string; maxBytes: number; maxLabel: string }
> = {
  KYC_DOCUMENT: {
    types: ['image/jpeg', 'image/png', 'application/pdf'],
    label: 'JPEG, PNG ou PDF',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 Mo',
  },
  PRODUCT_IMAGE: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPEG, PNG ou WebP',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 Mo',
  },
  PRODUCT_VIDEO: {
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    label: 'MP4, WebM ou MOV',
    maxBytes: 15 * 1024 * 1024,
    maxLabel: '15 Mo',
  },
  CHAT_IMAGE: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPEG, PNG ou WebP',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 Mo',
  },
  DISPUTE_EVIDENCE: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPEG, PNG ou WebP',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 Mo',
  },
  DELIVERY_PROOF: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPEG, PNG ou WebP',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5 Mo',
  },
};

export class UploadError extends Error {}

/** Attribut `accept` à mettre sur le champ fichier, pour filtrer dès le sélecteur */
export function acceptAttribute(purpose: UploadPurpose) {
  return ACCEPTED[purpose].types.join(',');
}

/**
 * Renvoie un message d'erreur lisible si le fichier n'est pas acceptable, sinon null.
 * Source unique des règles côté interface : utilisée à la sélection (retour immédiat) et
 * avant l'envoi. L'API revérifie tout de toute façon.
 */
export function validateFile(file: File, purpose: UploadPurpose): string | null {
  const rule = ACCEPTED[purpose];
  if (!rule.types.includes(file.type)) return `« ${file.name} » : format non accepté (${rule.label}).`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  if (file.size > rule.maxBytes) return `« ${file.name} » dépasse ${rule.maxLabel}.`;
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Impossible de lire « ${file.name} »`));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimise automatiquement une photo issue de la galerie ou de la caméra
 * (redimensionnement max 1440 px et compression JPEG 0.82) pour économiser
 * la bande passante mobile en RDC tout en gardant une image nette.
 */
export async function readCompressedImageDataUrl(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<{ dataUrl: string; compressed: boolean }> {
  const maxDimension = options?.maxDimension ?? 1440;
  const quality = options?.quality ?? 0.82;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { dataUrl: await readFileAsDataUrl(file), compressed: false };
  }

  // Petite image déjà légère : inutile de ré-encoder
  if (file.size <= 180 * 1024) {
    return { dataUrl: await readFileAsDataUrl(file), compressed: false };
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH, 1));
        const targetW = Math.max(1, Math.round(naturalW * scale));
        const targetH = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, compressed: false }), reject);
          return;
        }

        // Fond blanc pour les PNG transparents ré-encodés en JPEG léger
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const encoded = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);

        if (encoded.startsWith('data:image/jpeg;base64,')) {
          resolve({ dataUrl: encoded, compressed: true });
        } else {
          readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, compressed: false }), reject);
        }
      } catch {
        URL.revokeObjectURL(objectUrl);
        readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, compressed: false }), reject);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, compressed: false }), reject);
    };

    img.src = objectUrl;
  });
}

export async function compressImageFile(file: File): Promise<File> {
  try {
    const { dataUrl, compressed } = await readCompressedImageDataUrl(file);
    if (!compressed) return file;
    const base64 = dataUrl.split(',')[1];
    if (!base64) return file;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([bytes], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Impossible de lire la durée de cette vidéo.'));
    }, 8000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number(video.duration);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Durée vidéo invalide ou fichier corrompu.'));
        return;
      }
      resolve(duration);
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('Format vidéo illisible dans le navigateur.'));
    };

    video.src = objectUrl;
  });
}

/**
 * Envoie un fichier directement au stockage et renvoie sa clé, à transmettre ensuite au
 * formulaire métier (ex: POST /kyc/documents). Les contrôles faits ici ne servent qu'au
 * confort : l'API refuse de toute façon un type ou une taille non autorisés.
 */
export async function uploadFile(file: File, purpose: UploadPurpose): Promise<string> {
  const problem = validateFile(file, purpose);
  if (problem) throw new UploadError(problem);

  let presigned:
    | { mode: 'local'; key: string }
    | { mode: 's3'; uploadUrl: string; key: string; requiredHeaders: Record<string, string> };
  try {
    const { data } = await api.post('/uploads/presign', {
      purpose,
      contentType: file.type,
      sizeBytes: file.size,
    });
    presigned = data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429) throw new UploadError("Trop d'envois en peu de temps. Patientez une minute.");
    if (status === 503) throw new UploadError("L'envoi de fichiers est momentanément indisponible.");
    if (status === 403) throw new UploadError("Vous n'avez pas le droit d'envoyer ce type de fichier.");
    throw new UploadError("Impossible de préparer l'envoi du fichier.");
  }

  if (presigned.mode === 'local') {
    const form = new FormData();
    form.append('purpose', purpose);
    form.append('key', presigned.key);
    form.append('file', file);
    try {
      const { data } = await api.post<{ key: string }>('/uploads/local', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.key;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) throw new UploadError("Trop d'envois en peu de temps. Patientez une minute.");
      if (status === 413) throw new UploadError('Le fichier dépasse la limite de 5 Mo.');
      throw new UploadError("Impossible d'enregistrer le document sur cet ordinateur.");
    }
  }

  let response: Response;
  try {
    // fetch et NON l'instance axios `api` : celle-ci ajoute notre jeton de connexion à chaque
    // requête. L'envoyer au fournisseur de stockage le lui divulguerait, et casserait la
    // signature de l'URL. L'URL signée suffit à autoriser cet envoi, rien d'autre à joindre.
    response = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.requiredHeaders,
      body: file,
    });
  } catch {
    throw new UploadError("Envoi impossible. Vérifiez votre connexion et réessayez.");
  }

  if (!response.ok) throw new UploadError('Le stockage a refusé le fichier. Réessayez.');

  return presigned.key;
}

export function dataUrlToFile(dataUrl: string, fallbackName = 'media'): File {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new UploadError('Format média invalide pour téléversement.');
  }
  const mime = match[1].toLowerCase();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
      ? 'webp'
      : mime === 'video/mp4'
      ? 'mp4'
      : mime === 'video/webm'
      ? 'webm'
      : mime === 'video/quicktime'
      ? 'mov'
      : 'jpg';
  const cleanBase = fallbackName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'media';
  return new File([bytes], `${cleanBase}.${ext}`, { type: mime });
}

