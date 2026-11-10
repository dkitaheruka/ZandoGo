import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Decision = 'RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_PARTIAL';

interface Dispute {
  id: string;
  reasonCategory: string;
  description: string;
  status: string;
  openedAt: string;
  slaDeadline: string;
  order: { orderNumber: string; total: string | number; currency: 'USD' | 'CDF' };
}

const REASON_LABEL: Record<string, string> = {
  PRODUCT_NOT_RECEIVED: 'Produit non reçu',
  PRODUCT_DAMAGED: 'Produit endommagé',
  WRONG_ITEM: 'Mauvais article',
  OTHER: 'Autre',
};

const DECISION_LABEL: Record<Decision, string> = {
  RESOLVED_REFUND: 'Rembourser le client',
  RESOLVED_RELEASE: 'Donner raison au vendeur (libérer les fonds)',
  RESOLVED_PARTIAL: 'Remboursement partiel',
};

export function DisputesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.some((r) => r.role === 'SUPER_ADMIN') ?? false;

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api
      .get<Dispute[]>('/disputes')
      .then(({ data }) => setDisputes(data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Litiges ouverts</h1>
      <p className="mt-2 text-encre/60">
        Triés par échéance : chaque litige doit être tranché sous 48h.
        {!isSuperAdmin && ' Seul un super administrateur peut rendre une décision.'}
      </p>

      {loading ? (
        <p className="mt-10 text-encre/50">Chargement…</p>
      ) : disputes.length === 0 ? (
        <p className="mt-10 text-encre/50">Aucun litige en cours.</p>
      ) : (
        <div className="mt-8 space-y-5">
          {disputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} canResolve={isSuperAdmin} onResolved={load} />
          ))}
        </div>
      )}
    </div>
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
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(dispute.slaDeadline);
  const hoursLeft = (deadline.getTime() - Date.now()) / 36e5;
  const overdue = hoursLeft < 0;

  async function handleResolve() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/disputes/${dispute.id}/resolve`, {
        status: decision,
        resolutionNote: note,
        amountRefunded: decision === 'RESOLVED_PARTIAL' ? Number(amount) : undefined,
      });
      onResolved();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Décision impossible.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-encre/10 p-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-medium">
            Commande {dispute.order.orderNumber} ·{' '}
            {Number(dispute.order.total).toLocaleString('fr-FR')} {dispute.order.currency}
          </p>
          <p className="text-sm text-encre/50 mt-0.5">{REASON_LABEL[dispute.reasonCategory] ?? dispute.reasonCategory}</p>
        </div>
        <span
          className={`text-xs font-medium px-3 py-1 flex-shrink-0 ${
            overdue ? 'bg-wax/15 text-wax' : hoursLeft < 12 ? 'bg-safran/25 text-nuit' : 'bg-seve/15 text-seve'
          }`}
        >
          {overdue ? `En retard de ${Math.ceil(-hoursLeft)} h` : `${Math.ceil(hoursLeft)} h restantes`}
        </span>
      </div>

      <p className="mt-3 text-sm text-encre/80">{dispute.description}</p>

      {canResolve && (
        <div className="mt-5 pt-5 border-t border-encre/10 space-y-3">
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-full border border-encre/20 px-3 py-2"
          >
            {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
              <option key={d} value={d}>
                {DECISION_LABEL[d]}
              </option>
            ))}
          </select>

          {decision === 'RESOLVED_PARTIAL' && (
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Montant remboursé (${dispute.order.currency})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-encre/20 px-3 py-2"
            />
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Motif de la décision (10 caractères minimum, conservé pour l'audit)"
            className="w-full border border-encre/20 px-3 py-2 resize-none"
          />

          {error && <p className="text-sm text-wax">{error}</p>}

          <button
            onClick={handleResolve}
            disabled={busy || note.length < 10}
            className="bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Enregistrement…' : 'Rendre la décision'}
          </button>
        </div>
      )}
    </div>
  );
}
