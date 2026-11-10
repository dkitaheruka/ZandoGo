import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { openKycDocument } from '../../lib/kyc';

interface PendingKyc {
  id: string;
  type: 'ID_CARD' | 'VENDOR_LICENSE' | 'DRIVER_LICENSE';
  createdAt: string;
  user: { id: string; fullName: string; email?: string; phone?: string };
}

const TYPE_LABEL: Record<PendingKyc['type'], string> = {
  ID_CARD: "Pièce d'identité",
  VENDOR_LICENSE: 'Document vendeur',
  DRIVER_LICENSE: 'Permis / pièce livreur',
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
      setDocError("Impossible d'ouvrir ce document. Réessayez.");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data } = await api.get<PendingKyc[]>('/kyc/documents/pending');
      setDocuments(data);
    } catch {
      setListError('Impossible de charger la file KYC. Vérifiez votre connexion et réessayez.');
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
      setListError('Impossible de mettre à jour ce document. Il est peut-être déjà traité.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Validation des documents</h1>
      <p className="mt-2 text-encre/60">Les plus anciens en premier.</p>
      {docError && <p className="mt-4 text-sm text-wax">{docError}</p>}
      {listError && (
        <div role="alert" className="mt-4 rounded-lg border border-wax/30 bg-wax/10 p-4 text-sm text-wax">
          <p>{listError}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-medium underline">
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-encre/50" role="status">Chargement…</p>
      ) : documents.length === 0 ? (
        <p className="mt-10 text-encre/50">Aucun document en attente.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="border border-encre/10 p-5 flex items-center justify-between gap-6">
              <div>
                <p className="font-medium">{doc.user.fullName}</p>
                <p className="text-sm text-encre/50">{doc.user.email ?? doc.user.phone}</p>
                <p className="mt-2 text-sm">
                  {TYPE_LABEL[doc.type]} ·{' '}
                  <button
                    type="button"
                    onClick={() => openDocument(doc.id)}
                    className="text-seve hover:underline"
                  >
                    Ouvrir le document
                  </button>
                </p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <button
                  disabled={busyId === doc.id}
                  onClick={() => review(doc.id, 'APPROVED')}
                  className="bg-seve text-white text-sm font-medium px-4 py-2 hover:bg-seve/90 transition-colors disabled:opacity-60"
                >
                  Approuver
                </button>
                <button
                  disabled={busyId === doc.id}
                  onClick={() => review(doc.id, 'REJECTED')}
                  className="border border-wax text-wax text-sm font-medium px-4 py-2 hover:bg-wax/10 transition-colors disabled:opacity-60"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
