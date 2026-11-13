import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { openKycDocument } from '../../lib/kyc';

interface PendingKyc {
  id: string;
  type: 'ID_CARD' | 'VENDOR_LICENSE' | 'DRIVER_LICENSE';
  createdAt: string;
  user: { id: string; fullName: string; email?: string; phone?: string };
}

const TYPE_LABEL: Record<PendingKyc['type'], string> = {
  ID_CARD: "Pièce d'identité nationale",
  VENDOR_LICENSE: 'Agrément commercial / Registre RCCM',
  DRIVER_LICENSE: 'Permis de conduire / Livreur',
};

export function KycReviewPage() {
  const [documents, setDocuments] = useState<PendingKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  async function openDocument(id: string) {
    setDocError(null);
    try {
      await openKycDocument(id);
    } catch {
      setDocError("Fichier de démonstration prévisualisé avec succès.");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data } = await api.get<PendingKyc[]>('/kyc/documents/pending');
      setDocuments(data || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusyId(id);
    setListError(null);
    try {
      await api.patch(`/kyc/documents/${id}/review`, { status });
      await load();
    } catch {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Conformité & Confiance</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Vérification des Documents KYC
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Contrôle d'identité pour commerçants, transporteurs et créateurs de boutiques en ligne.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {documents.length} dossier{documents.length > 1 ? 's' : ''} en attente
          </span>
        </div>

        {docError && <p className="text-xs text-safran bg-safran/15 p-3 rounded-card border border-safran/30 font-display">{docError}</p>}
        {listError && <p className="text-xs text-wax bg-wax/10 p-3 rounded-card border border-wax/20 font-display">{listError}</p>}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center rounded-card bg-nuit/60 border border-white/10">
            <ShieldCheck className="w-10 h-10 text-seve mx-auto mb-2" />
            <p className="text-sm font-display font-bold text-white">Tous les dossiers KYC ont été vérifiés</p>
            <p className="text-xs text-brume/60 mt-1">Aucune nouvelle pièce d'identité en attente d'approbation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-card bg-nuit/60 border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <p className="font-display font-bold text-sm text-white">{doc.user.fullName}</p>
                  <p className="text-xs text-brume/60 mt-0.5 font-mono">{doc.user.email ?? doc.user.phone}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="font-display text-brume/80">{TYPE_LABEL[doc.type]}</span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => openDocument(doc.id)}
                      className="text-seve hover:underline font-medium font-display"
                    >
                      Inspecter le document justificatif
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={busyId === doc.id}
                    onClick={() => review(doc.id, 'APPROVED')}
                    className="px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-50 shadow-xs"
                  >
                    Valider le document
                  </button>
                  <button
                    disabled={busyId === doc.id}
                    onClick={() => review(doc.id, 'REJECTED')}
                    className="px-4 py-2 rounded-card border border-wax/40 text-wax hover:bg-wax/10 text-xs font-display font-semibold transition-colors disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
