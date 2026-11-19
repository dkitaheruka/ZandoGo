import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Eye, XCircle } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { KycDocumentModal, type KycModalTarget } from '../../components/admin/KycDocumentModal';
import { api } from '../../lib/api';

type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface PendingAgent {
  id: string;
  vehicleType?: string;
  user: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    kycDocuments: { id: string; status: KycStatus; type?: 'ID_CARD' | 'VENDOR_LICENSE' | 'DRIVER_LICENSE'; createdAt?: string }[];
  };
}

export function AgentsReviewPage() {
  const [agents, setAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [kycBusyId, setKycBusyId] = useState<string | null>(null);
  const [inspectedDoc, setInspectedDoc] = useState<KycModalTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PendingAgent[]>('/delivery/agents/pending');
      setAgents(data || []);
    } catch (err: any) {
      setAgents([]);
      setError(
        err?.response?.data?.message ||
          'Impossible de charger les candidatures de transporteurs.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(agentId: string) {
    setBusyId(agentId);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/delivery/agents/${agentId}/approve`);
      setSuccess('Coursier certifié et ajouté à la flotte active avec succès.');
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Impossible d'agréer ce transporteur. Vérifiez d'abord son justificatif KYC.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reviewAgentKyc(docId: string, status: 'APPROVED' | 'REJECTED') {
    setKycBusyId(docId);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/kyc/documents/${docId}/review`, { status });
      setInspectedDoc(null);
      setSuccess(
        status === 'APPROVED'
          ? 'Permis / justificatif validé. Vous pouvez maintenant agréer le transporteur.'
          : 'Justificatif rejeté. Le candidat devra soumettre un document plus net.',
      );
      await load();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors de la validation du justificatif du transporteur.',
      );
    } finally {
      setKycBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Flotte Logistique</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Agrément des Transporteurs & Coursiers
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Validation des motards et entreprises de fret partenaires assurant les livraisons à Goma (Nord-Kivu) et dans la région du Kivu.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {agents.length} candidat{agents.length > 1 ? 's' : ''} en attente
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax flex items-center justify-between gap-3" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="underline font-semibold shrink-0">
              Actualiser
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-card bg-seve/10 border border-seve/30 text-xs text-seve font-medium">
            {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center rounded-card bg-nuit/60 border border-white/10">
            <p className="text-sm font-display font-bold text-white">Aucune candidature de coursier en attente</p>
            <p className="text-xs text-brume/60 mt-1">La flotte actuelle de transporteurs est opérationnelle.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => {
              const docs = agent.user.kycDocuments || [];
              const approvedDoc = docs.find((d) => d.status === 'APPROVED');
              const primaryDoc = approvedDoc || docs[0];
              const isKycApproved = Boolean(approvedDoc);

              return (
                <div
                  key={agent.id}
                  className="p-5 rounded-card bg-nuit/60 border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xs"
                >
                  <div>
                    <p className="font-display font-bold text-sm text-white">{agent.user.fullName}</p>
                    <p className="text-xs text-brume/60 mt-0.5 font-mono">
                      {agent.user.email ?? agent.user.phone} · Véhicule :{' '}
                      <strong className="text-brume">{agent.vehicleType || 'Moto Express'}</strong>
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-display">
                      {isKycApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-seve font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Permis & Justificatifs validés</span>
                        </span>
                      ) : primaryDoc?.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 text-safran font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Permis / pièce en attente de validation</span>
                        </span>
                      ) : primaryDoc?.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1.5 text-wax font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Justificatif refusé — nouvelle pièce requise</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-wax font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Aucun permis / justificatif KYC déposé</span>
                        </span>
                      )}

                      {primaryDoc && (
                        <>
                          <span className="text-white/25">·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setInspectedDoc({
                                id: primaryDoc.id,
                                type: primaryDoc.type ?? 'DRIVER_LICENSE',
                                status: primaryDoc.status,
                                createdAt: primaryDoc.createdAt,
                                holderName: agent.user.fullName,
                                holderContact: agent.user.email ?? agent.user.phone,
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-seve hover:underline font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspecter le document justificatif</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={busyId === agent.id || !isKycApproved}
                    onClick={() => void approve(agent.id)}
                    title={
                      isKycApproved
                        ? 'Agréer ce transporteur'
                        : 'Validez d’abord le justificatif KYC du candidat'
                    }
                    className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed shadow-xs"
                  >
                    {busyId === agent.id ? 'Activation…' : 'Agréer le transporteur'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <KycDocumentModal
        target={inspectedDoc}
        busy={Boolean(inspectedDoc && kycBusyId === inspectedDoc.id)}
        onClose={() => setInspectedDoc(null)}
        onDecision={(docId, status) => reviewAgentKyc(docId, status)}
      />
    </AdminLayout>
  );
}
