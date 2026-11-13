import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { acceptAttribute, UploadError, uploadFile, validateFile } from '../lib/upload';

type KycType = 'ID_CARD' | 'VENDOR_LICENSE' | 'DRIVER_LICENSE';
type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface KycDocument {
  id: string;
  type: KycType;
  status: KycStatus;
  createdAt: string;
}

const TYPE_LABEL: Record<KycType, string> = {
  ID_CARD: "Pièce d'identité",
  VENDOR_LICENSE: 'Document vendeur',
  DRIVER_LICENSE: 'Permis / pièce livreur',
};

const STATUS_LABEL: Record<KycStatus, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-safran/20 text-nuit' },
  APPROVED: { label: 'Approuvé', className: 'bg-seve/15 text-seve' },
  REJECTED: { label: 'Refusé', className: 'bg-wax/15 text-wax' },
};

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return undefined;
  const data = response.data;
  if (!data || typeof data !== 'object' || !('message' in data)) return undefined;
  const message = data.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }
  return undefined;
}

export function KycPage() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [type, setType] = useState<KycType>('VENDOR_LICENSE');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setDocumentsError(null);
    try {
      const { data } = await api.get<KycDocument[]>('/kyc/documents/mine');
      setDocuments(data);
    } catch {
      setDocumentsError("Impossible de charger vos documents. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Choisissez un fichier à envoyer.');
      return;
    }
    const fileError = validateFile(file, 'KYC_DOCUMENT');
    if (fileError) {
      setError(fileError);
      return;
    }

    setSubmitting(true);
    try {
      // 1) le fichier part directement au stockage privé, 2) on transmet seulement sa clé
      const fileKey = await uploadFile(file, 'KYC_DOCUMENT');
      await api.post('/kyc/documents', { type, fileKey });
      setFile(null);
      (e.target as HTMLFormElement).reset();
      await loadDocuments();
    } catch (err: unknown) {
      setError(
        err instanceof UploadError
          ? err.message
          : (getErrorMessage(err) ?? 'Impossible de soumettre le document.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-nuit">Vérification d'identité</h1>
      <p className="mt-2 text-xs text-encre/70">
        Requise pour activer une boutique vendeur ou un compte livreur sur la place de marché ZandoGo.
      </p>

      {documentsError && (
        <div role="alert" className="mt-6 rounded-card border border-wax/30 bg-wax/10 p-4 text-xs text-wax">
          <p>{documentsError}</p>
          <button type="button" onClick={() => void loadDocuments()} className="mt-2 font-medium underline">
            Réessayer
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-card border border-wax/30 bg-wax/10 p-4 text-xs text-wax">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-encre/50 text-xs font-mono" role="status">Chargement de vos documents…</p>
      ) : documents.length > 0 ? (
        <div className="mt-8 space-y-3">
          {documents.map((doc) => {
            const status = STATUS_LABEL[doc.status];
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-card border border-encre/10 bg-white p-4 shadow-xs"
              >
                <div>
                  <p className="font-semibold text-nuit text-sm">{TYPE_LABEL[doc.type]}</p>
                  <p className="mt-1 text-xs text-encre/50 font-mono">
                    Envoyé le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className={`text-xs font-display font-semibold rounded-card px-3 py-1 ${status.className}`} role="status">
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 text-xs text-encre/50">Aucun document envoyé pour le moment.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-card bg-white border border-encre/10 p-6 shadow-xs">
        <div>
          <label htmlFor="kyc-type" className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
            Type de document *
          </label>
          <select
            id="kyc-type"
            value={type}
            onChange={(e) => setType(e.target.value as KycType)}
            disabled={submitting}
            className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve"
          >
            <option value="VENDOR_LICENSE">Document vendeur (Registre de commerce / Patente)</option>
            <option value="DRIVER_LICENSE">Permis de conduire / Pièce livreur</option>
            <option value="ID_CARD">Carte d'électeur / Passeport RDC</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5" htmlFor="kyc-file">
            Document (JPEG, PNG ou PDF, 5 Mo maximum) *
          </label>
          <input
            id="kyc-file"
            required
            type="file"
            accept={acceptAttribute('KYC_DOCUMENT')}
            disabled={submitting}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] ?? null;
              setFile(selectedFile);
              setError(selectedFile ? validateFile(selectedFile, 'KYC_DOCUMENT') : null);
            }}
            className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre file:mr-4 file:py-1.5 file:px-3 file:rounded-card file:border-0 file:text-xs file:font-semibold file:bg-nuit file:text-brume hover:file:bg-nuit/90"
          />
          <p className="mt-1.5 text-[11px] text-encre/50">
            Votre document est stocké de façon privée et chiffrée. Il n'est consulté que par l'équipe de vérification ZandoGo.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full rounded-card bg-seve text-brume font-display font-bold py-3.5 hover:bg-seve/90 transition-colors disabled:opacity-60 text-xs shadow-xs"
        >
          {submitting ? 'Envoi en cours…' : 'Soumettre le document'}
        </button>
      </form>
    </div>
  );
}
