import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { fetchKycDocumentPreview, type KycDocumentPreview } from '../../lib/kyc';

export type KycDocType = 'ID_CARD' | 'VENDOR_LICENSE' | 'DRIVER_LICENSE';
export type KycDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycModalTarget {
  id: string;
  type?: KycDocType;
  status?: KycDocStatus;
  createdAt?: string;
  holderName: string;
  holderContact?: string;
}

const TYPE_LABEL: Record<KycDocType, string> = {
  ID_CARD: "Pièce d'identité nationale",
  VENDOR_LICENSE: 'Agrément commercial / Registre RCCM',
  DRIVER_LICENSE: 'Permis de conduire / Pièce livreur',
};

interface KycDocumentModalProps {
  target: KycModalTarget | null;
  busy?: boolean;
  onClose: () => void;
  onDecision?: (documentId: string, status: 'APPROVED' | 'REJECTED') => Promise<void> | void;
}

export function KycDocumentModal({
  target,
  busy = false,
  onClose,
  onDecision,
}: KycDocumentModalProps) {
  const [preview, setPreview] = useState<KycDocumentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const loadPreview = useCallback(async (documentId: string) => {
    setLoading(true);
    setError(null);
    setZoomed(false);
    try {
      const next = await fetchKycDocumentPreview(documentId);
      setPreview((prev) => {
        prev?.revoke();
        return next;
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message;
      setError(
        typeof msg === 'string' && msg.trim()
          ? msg
          : 'Impossible de charger ce document justificatif pour le moment.',
      );
      setPreview((prev) => {
        prev?.revoke();
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!target) {
      setPreview((prev) => {
        prev?.revoke();
        return null;
      });
      setError(null);
      return;
    }
    void loadPreview(target.id);
  }, [target?.id, loadPreview]);

  useEffect(() => {
    return () => {
      preview?.revoke();
    };
  }, [preview]);

  useEffect(() => {
    if (!target) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [target, onClose]);

  if (!target) return null;

  const isPdf = preview?.mimeType === 'application/pdf';
  const canDecide = Boolean(onDecision && (!target.status || target.status === 'PENDING'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nuit/80 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-modal-title"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-card bg-nuit border border-white/15 shadow-2xl overflow-hidden text-brume"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-4 bg-white/[0.03]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-seve">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Inspection Document Justificatif (Audit Journalisé)</span>
              </span>
              {target.status && (
                <span
                  className={`px-2 py-0.5 rounded-card text-[10px] font-display font-bold ${
                    target.status === 'APPROVED'
                      ? 'bg-seve/20 text-seve'
                      : target.status === 'REJECTED'
                      ? 'bg-wax/20 text-wax'
                      : 'bg-safran/20 text-safran'
                  }`}
                >
                  {target.status === 'APPROVED'
                    ? 'Validé'
                    : target.status === 'REJECTED'
                    ? 'Refusé'
                    : 'En attente de validation'}
                </span>
              )}
            </div>
            <h2 id="kyc-modal-title" className="mt-1 font-display text-lg font-bold text-white truncate">
              {target.holderName}
            </h2>
            <p className="text-xs text-brume/65 mt-0.5 flex flex-wrap items-center gap-2">
              <span>{target.type ? TYPE_LABEL[target.type] : 'Pièce justificative KYC'}</span>
              {target.holderContact && (
                <>
                  <span>·</span>
                  <span className="font-mono">{target.holderContact}</span>
                </>
              )}
              {target.createdAt && (
                <>
                  <span>·</span>
                  <span className="font-mono">
                    Déposé le {new Date(target.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {preview && !isPdf && (
              <button
                type="button"
                onClick={() => setZoomed((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-white/10 hover:bg-white/15 text-xs font-display font-semibold text-brume transition"
                title={zoomed ? 'Ajuster à la fenêtre' : 'Zoomer'}
              >
                {zoomed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{zoomed ? 'Ajuster' : 'Agrandir'}</span>
              </button>
            )}
            {preview && (
              <a
                href={preview.previewUrl}
                download={preview.fileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-white/10 hover:bg-white/15 text-xs font-display font-semibold text-safran transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-card text-brume/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Fermer la fenêtre d'inspection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 min-h-[340px] overflow-auto bg-[#0f1715] p-4 sm:p-6 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-xs text-brume/70 font-mono py-16">
              <Loader2 className="w-7 h-7 animate-spin text-seve" />
              <span>Récupération sécurisée du document justificatif…</span>
            </div>
          ) : error ? (
            <div className="max-w-md w-full rounded-card bg-wax/10 border border-wax/30 p-5 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-wax mx-auto" />
              <p className="text-sm font-display font-bold text-white">Document indisponible</p>
              <p className="text-xs text-brume/80">{error}</p>
              <button
                type="button"
                onClick={() => void loadPreview(target.id)}
                className="px-4 py-2 rounded-card bg-white/10 hover:bg-white/15 text-xs font-display font-semibold text-white transition"
              >
                Réessayer le chargement
              </button>
            </div>
          ) : preview ? (
            isPdf ? (
              <div className="w-full h-[60vh] flex flex-col gap-3">
                <iframe
                  src={preview.previewUrl}
                  title={`Document justificatif — ${target.holderName}`}
                  className="w-full flex-1 rounded-card border border-white/15 bg-white"
                />
                <div className="flex items-center justify-between text-[11px] text-brume/65 font-mono">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-safran" />
                    <span>{preview.fileName} (PDF)</span>
                  </span>
                  <a
                    href={preview.previewUrl}
                    download={preview.fileName}
                    className="text-seve hover:underline font-display font-semibold"
                  >
                    Enregistrer une copie PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className={`w-full flex justify-center ${zoomed ? 'overflow-auto' : ''}`}>
                <img
                  src={preview.previewUrl}
                  alt={`Justificatif KYC — ${target.holderName}`}
                  className={
                    zoomed
                      ? 'max-w-none w-auto rounded-card border border-white/15 shadow-lg'
                      : 'max-h-[62vh] max-w-full object-contain rounded-card border border-white/15 shadow-lg bg-white'
                  }
                />
              </div>
            )
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-mono text-brume/50">
            Réf. pièce : {target.id}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {canDecide && onDecision && (
              <>
                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() => void onDecision(target.id, 'REJECTED')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card border border-wax/40 text-wax hover:bg-wax/10 text-xs font-display font-semibold transition disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rejeter le document</span>
                </button>
                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() => void onDecision(target.id, 'APPROVED')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valider ce justificatif</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-card bg-white/10 hover:bg-white/15 text-xs font-display font-semibold text-brume transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
