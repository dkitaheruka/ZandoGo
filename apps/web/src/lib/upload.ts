import { api } from './api';

export type UploadPurpose = 'KYC_DOCUMENT' | 'PRODUCT_IMAGE';

const MAX_BYTES = 5 * 1024 * 1024; // même plafond que l'API, qui revérifie de toute façon

const ACCEPTED: Record<UploadPurpose, { types: string[]; label: string }> = {
  KYC_DOCUMENT: { types: ['image/jpeg', 'image/png', 'application/pdf'], label: 'JPEG, PNG ou PDF' },
  PRODUCT_IMAGE: { types: ['image/jpeg', 'image/png', 'image/webp'], label: 'JPEG, PNG ou WebP' },
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
  if (file.size > MAX_BYTES) return `« ${file.name} » dépasse 5 Mo.`;
  return null;
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
