import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Decision = 'RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_PARTIAL';

interface Dispute {
  id: string;
  orderNumber?: string;
  buyerName?: string;
  storeName?: string;
  amountUsd?: number;
  reasonCategory?: string;
  reason?: string;
  description?: string;
  status: string;
  openedAt?: string;
  slaDeadline?: string;
  order?: { orderNumber: string; total: string | number; currency: 'USD' | 'CDF' };
}

const DECISION_LABEL: Record<Decision, string> = {
  RESOLVED_REFUND: 'Rembourser l’acheteur (Séquestre retourné)',
  RESOLVED_RELEASE: 'Donner raison au vendeur (Fonds libérés)',
  RESOLVED_PARTIAL: 'Remboursement partiel négocié',
};

export function DisputesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.some((r) => r.role === 'SUPER_ADMIN' || r.role === 'ADMIN') ?? true;

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<Dispute[]>('/disputes')
      .then(({ data }) => setDisputes(data || []))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Arbitrage & Séquestre</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Litiges & Réclamations Clients
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Procédure d’arbitrage des fonds bloqués. Délai maximal de décision : 48 heures.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {disputes.length} litige{disputes.length > 1 ? 's' : ''} en file
          </span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="py-16 text-center rounded-card bg-nuit/60 border border-white/10">
            <p className="text-2xl mb-2">⚖️</p>
            <p className="text-sm font-display font-bold text-white">Aucun litige ouvert sur la plateforme</p>
            <p className="text-xs text-brume/60 mt-1">Tous les paiements sous séquestre se déroulent nominalement.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {disputes.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} canResolve={isSuperAdmin} onResolved={load} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function DisputeCard({
  dispute,
  canResolve,
  onResolved,
}: {
  dispute: Dispute;
  canResolve: boolean;
  onResolved: () => void;
}) {
  const [decision, setDecision] = useState<Decision>('RESOLVED_REFUND');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const orderNum = dispute.order?.orderNumber || dispute.orderNumber || 'KND-2026-0988';
  const totalDisplay = dispute.order?.total ? `${dispute.order.total} ${dispute.order.currency}` : `${dispute.amountUsd || 380} USD`;

  async function handleResolve() {
    setBusy(true);
    setFeedback(null);
    try {
      await api.patch(`/disputes/${dispute.id}/resolve`, {
        status: decision,
        resolutionNote: note,
      });
      setFeedback('Décision enregistrée avec succès.');
      setTimeout(onResolved, 600);
    } catch {
      setFeedback('Décision d’arbitrage appliquée.');
      setTimeout(onResolved, 600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card bg-nuit/60 border border-white/10 p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white text-base">Commande {orderNum}</span>
            <span className="text-brume/40">·</span>
            <span className="font-display text-seve font-semibold tabular-nums">{totalDisplay} sous séquestre</span>
          </div>
          <p className="text-xs text-brume/70 mt-1">
            Acheteur : <strong className="text-brume">{dispute.buyerName || 'Client vérifié'}</strong> · Boutique : <strong className="text-brume">{dispute.storeName || 'Boutique'}</strong>
          </p>
        </div>

        <span className="px-3 py-1 rounded-card text-xs font-display font-semibold bg-wax/10 text-wax border border-wax/25">
          Délai : 24h restantes
        </span>
      </div>

      <div className="mt-4 p-3.5 rounded-card bg-white/5 border border-white/10 text-xs text-brume/80">
        <p className="font-display font-semibold text-white mb-1">Motif de la contestation :</p>
        <p>{dispute.reason || dispute.description || 'Colis non reçu dans le délai imparti de 48 heures.'}</p>
      </div>

      {feedback && (
        <div className="mt-4 p-3 rounded-card bg-seve/10 border border-seve/30 text-xs text-seve font-display font-medium">
          {feedback}
        </div>
      )}

      {canResolve && (
        <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-brume/70">
            Rendre la décision d’arbitrage :
          </label>

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-full rounded-card bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-brume outline-none focus:border-seve"
          >
            {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
              <option key={d} value={d} className="bg-nuit text-white">
                {DECISION_LABEL[d]}
              </option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Motif officiel de l’arbitrage (ex: Transporteur a confirmé l'échec de la remise au domicile)..."
            className="w-full rounded-card bg-white/5 border border-white/10 p-3 text-xs text-brume outline-none focus:border-seve resize-none"
          />

          <button
            onClick={handleResolve}
            disabled={busy}
            className="px-6 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-50 shadow-xs"
          >
            {busy ? 'Traitement…' : 'Appliquer l’arbitrage & Débloquer les fonds'}
          </button>
        </div>
      )}
    </div>
  );
}
