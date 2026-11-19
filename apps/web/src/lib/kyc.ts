import { api } from './api';

export interface KycDocumentPreview {
  previewUrl: string;
  mimeType: string;
  fileName: string;
  revoke: () => void;
}

interface KycFileUrlResponse {
  url: string;
  mimeType?: string;
  fileName?: string;
}

function inferMimeType(url: string, fallback = 'image/jpeg'): string {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:application/pdf') || /\.pdf(\?|$)/.test(lower)) return 'application/pdf';
  if (lower.startsWith('data:image/svg+xml') || /\.svg(\?|$)/.test(lower)) return 'image/svg+xml';
  if (lower.startsWith('data:image/png') || /\.png(\?|$)/.test(lower)) return 'image/png';
  if (lower.startsWith('data:image/webp') || /\.webp(\?|$)/.test(lower)) return 'image/webp';
  if (lower.startsWith('data:image/jpeg') || /\.(jpg|jpeg)(\?|$)/.test(lower)) return 'image/jpeg';
  return fallback;
}

/**
 * Récupère une URL de prévisualisation sécurisée pour un document KYC (admin uniquement,
 * consultation journalisée côté API). Les chemins locaux (/api/uploads/local/...) sont
 * récupérés avec le jeton authentifié sous forme de Blob révocable afin de s'afficher
 * directement dans la visionneuse modale sans popup bloquée par l'iframe.
 */
export async function fetchKycDocumentPreview(documentId: string): Promise<KycDocumentPreview> {
  const { data } = await api.get<KycFileUrlResponse>(`/kyc/documents/${documentId}/file-url`);
  if (!data?.url) {
    throw new Error('Aucun lien de document justificatif renvoyé par le serveur.');
  }

  const rawUrl = data.url;
  const fallbackName =
    data.fileName ||
    `justificatif-${documentId.slice(0, 8)}.${
      (data.mimeType || inferMimeType(rawUrl)).includes('pdf')
        ? 'pdf'
        : (data.mimeType || inferMimeType(rawUrl)).includes('svg')
        ? 'svg'
        : (data.mimeType || inferMimeType(rawUrl)).includes('png')
        ? 'png'
        : 'jpg'
    }`;

  if (rawUrl.startsWith('/')) {
    const apiPath = rawUrl.startsWith('/api/') ? rawUrl.slice(4) : rawUrl;
    const response = await api.get<Blob>(apiPath, { responseType: 'blob' });
    const mimeType =
      response.data?.type && response.data.type !== 'application/octet-stream'
        ? response.data.type
        : data.mimeType || inferMimeType(rawUrl);
    const objectUrl = URL.createObjectURL(response.data);
    return {
      previewUrl: objectUrl,
      mimeType,
      fileName: fallbackName,
      revoke: () => URL.revokeObjectURL(objectUrl),
    };
  }

  return {
    previewUrl: rawUrl,
    mimeType: data.mimeType || inferMimeType(rawUrl),
    fileName: fallbackName,
    revoke: () => {},
  };
}
