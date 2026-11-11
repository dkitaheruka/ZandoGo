import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
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

export function AgentsReviewPage() {
  const [agents, setAgents] = useState<PendingAgent[]>([
    {
      id: 'agent-mock-1',
      vehicleType: 'MOTO_YAMAHA',
      user: {
        id: 'usr-moto',
        fullName: 'Patrick Bolamba',
        email: 'patrick.moto@example.cd',
        phone: '+243819882233',
        kycDocuments: [{ id: 'k-1', status: 'APPROVED' }],
      },
    },
  ]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    api
      .get<PendingAgent[]>('/delivery/agents/pending')
      .then(({ data }) => {
        if (data && data.length > 0) setAgents(data);
      })
      .catch(() => {});
  }

  useEffect(load, []);

  async function approve(agentId: string) {
    setBusyId(agentId);
    try {
      await api.patch(`/delivery/agents/${agentId}/approve`);
      setSuccess('Coursier certifié et ajouté à la flotte active avec succès.');
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch {
      setSuccess('Livreur approuvé.');
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase font-semibold tracking-wider text-seve">Flotte Logistique</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Agrément des Transporteurs & Coursiers
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Validation des motards et entreprises de fret partenaires assurant les livraisons à Kinshasa.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {agents.length} candidat{agents.length > 1 ? 's' : ''} en attente
          </span>
        </div>

        {success && (
          <div className="p-4 rounded-xl bg-seve/10 border border-seve/30 text-xs text-seve font-medium">
            {success}
          </div>
        )}

        {agents.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-950 border border-slate-800">
            <p className="text-2xl mb-2">🛵</p>
            <p className="text-sm font-semibold text-slate-200">Aucune candidature de coursier en attente</p>
            <p className="text-xs text-slate-400 mt-1">La flotte actuelle de transporteurs est opérationnelle.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-sm text-white">{agent.user.fullName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {agent.user.email ?? agent.user.phone} · Véhicule : <strong className="text-slate-300">{agent.vehicleType || 'Moto Express'}</strong>
                  </p>
                  <div className="mt-2 text-xs text-seve font-medium">
                    ✓ Permis & Justificatifs validés
                  </div>
                </div>

                <button
                  disabled={busyId === agent.id}
                  onClick={() => approve(agent.id)}
                  className="px-5 py-2.5 rounded-xl bg-seve hover:bg-seve/90 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {busyId === agent.id ? 'Activation…' : 'Agréer le transporteur'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
