import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    kycDocuments: { id: string; status: KycStatus }[];
  };
}

const KYC_LABEL: Record<KycStatus | 'NONE', { label: string; className: string }> = {
  NONE: { label: 'Aucun document envoyé', className: 'bg-encre/10 text-encre/70' },
  PENDING: { label: 'Document en attente de validation', className: 'bg-safran/25 text-nuit' },
  APPROVED: { label: 'Document approuvé', className: 'bg-seve/15 text-seve' },
  REJECTED: { label: 'Document refusé', className: 'bg-wax/15 text-wax' },
};

export function AgentsReviewPage() {
  const [agents, setAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<PendingAgent[]>('/delivery/agents/pending')
      .then(({ data }) => setAgents(data))
      .catch(() => setError('Impossible de charger les candidatures des livreurs.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function approve(agentId: string) {
    setBusyId(agentId);
    setError(null);
    try {
      await api.patch(`/delivery/agents/${agentId}/approve`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Impossible d'approuver ce livreur.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Candidatures livreurs</h1>
      <p className="mt-2 text-encre/60">
        Un livreur ne peut être approuvé que si son document est déjà validé dans{' '}
        <Link to="/admin/kyc" className="text-seve hover:underline">
          la file des documents
        </Link>
        .
      </p>

      {error && (
        <div className="mt-6 text-sm text-wax" role="alert">
          {error} <button onClick={load} className="ml-2 underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-encre/50">Chargement…</p>
      ) : agents.length === 0 ? (
        <p className="mt-10 text-encre/50">Aucune candidature en attente.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {agents.map((agent) => {
            const kycStatus: KycStatus | 'NONE' = agent.user.kycDocuments.some((d) => d.status === 'APPROVED')
              ? 'APPROVED'
              : (agent.user.kycDocuments[0]?.status ?? 'NONE');
            const kyc = KYC_LABEL[kycStatus];

            return (
              <div key={agent.id} className="border border-encre/10 p-5 flex items-center justify-between gap-6">
                <div>
                  <p className="font-medium">{agent.user.fullName}</p>
                  <p className="text-sm text-encre/50">
                    {agent.user.email ?? agent.user.phone}
                    {agent.vehicleType && ` · ${agent.vehicleType}`}
                  </p>
                  <span className={`mt-2 inline-block text-xs font-medium px-3 py-1 ${kyc.className}`}>{kyc.label}</span>
                </div>
                <button
                  disabled={busyId === agent.id || kycStatus !== 'APPROVED'}
                  onClick={() => approve(agent.id)}
                  className="bg-seve text-white text-sm font-medium px-5 py-2 hover:bg-seve/90 transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  Approuver
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
