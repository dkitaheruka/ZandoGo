import { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import type { AdminPayoutRow } from '../../lib/types';

type PayoutStatusFilter = 'ALL' | 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';

const STATUS_BADGE: Record<AdminPayoutRow['status'], { label: string; cls: string }> = {
  REQUESTED: { label: 'Demandé', cls: 'bg-safran/15 text-safran border-safran/30' },
  APPROVED: { label: 'Approuvé', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
  PAID: { label: 'Payé', cls: 'bg-seve/20 text-emerald-300 border-seve/40' },
  REJECTED: { label: 'Rejeté (Recrédité)', cls: 'bg-wax/20 text-rose-300 border-wax/40' },
};

export function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PayoutStatusFilter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<AdminPayoutRow[]>('/wallets/admin/payouts')
      .then(({ data }) => setPayouts(Array.isArray(data) ? data : []))
      .catch(() => setError('Impossible de charger les demandes de décaissement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(row: AdminPayoutRow, status: 'APPROVED' | 'PAID' | 'REJECTED') {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/wallets/admin/payouts/${row.id}/status`, { status });
      setPayouts((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, status, processedAt: new Date().toISOString() } : item,
        ),
      );
      setNotice(
        status === 'PAID'
          ? `Décaissement de ${row.amount.toFixed(2)} ${row.currency} marqué comme payé pour ${row.storeName}.`
          : status === 'APPROVED'
            ? `Demande approuvée pour ${row.storeName}. Prête pour virement.`
            : `Demande rejetée : ${row.amount.toFixed(2)} ${row.currency} recrédités au portefeuille vendeur.`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible de mettre à jour ce retrait.');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(
    () => (filter === 'ALL' ? payouts : payouts.filter((p) => p.status === filter)),
    [payouts, filter],
  );

  const pendingAmount = payouts
    .filter((p) => p.status === 'REQUESTED' || p.status === 'APPROVED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran">
              Trésorerie &amp; Décaissements Vendeurs
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Gestion des Retraits Mobile Money &amp; Banque
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Validez, exécutez ou rejetez les demandes de retrait soumises par les boutiques et coursiers ZandoGo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-card bg-white/5 border border-white/10 px-4 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wider text-brume/50">En attente de traitement</p>
              <p className="font-mono font-bold text-safran text-base tabular-nums">${pendingAmount.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-card bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-brume transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'REQUESTED', 'APPROVED', 'PAID', 'REJECTED'] as PayoutStatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-card text-xs font-display font-semibold border transition ${
                filter === s
                  ? 'bg-seve text-brume border-seve'
                  : 'bg-white/5 text-brume/70 border-white/10 hover:text-white'
              }`}
            >
              {s === 'ALL' ? `Tous (${payouts.length})` : STATUS_BADGE[s].label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="rounded-card border border-seve/40 bg-seve/15 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-card border border-wax/40 bg-wax/15 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center rounded-card bg-nuit/60 border border-white/10">
            <Banknote className="w-10 h-10 text-safran/60 mx-auto mb-3" />
            <p className="text-sm font-display font-bold text-white">Aucune demande dans cette catégorie</p>
            <p className="text-xs text-brume/60 mt-1">Les nouvelles demandes de retrait apparaîtront ici en temps réel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-white/10 bg-nuit/80">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-white/5 text-brume/70 border-b border-white/10 font-display uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Boutique / Bénéficiaire</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Canal &amp; Destination</th>
                  <th className="px-4 py-3">Date demande</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions Trésorerie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((row) => {
                  const badge = STATUS_BADGE[row.status] || STATUS_BADGE.REQUESTED;
                  const canAct = row.status === 'REQUESTED' || row.status === 'APPROVED';
                  return (
                    <tr key={row.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5">
                        <p className="font-display font-bold text-white">{row.storeName}</p>
                        <p className="text-[11px] text-brume/60">
                          {row.ownerName} {row.ownerEmail ? `· ${row.ownerEmail}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-safran tabular-nums">
                        {Number(row.amount).toFixed(2)} {row.currency}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-white font-medium">{row.method}</p>
                        <p className="font-mono text-[11px] text-brume/60">{row.destination || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-brume/65">
                        {new Date(row.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-card border text-[11px] font-medium ${badge.cls}`}>
                          {row.status === 'REQUESTED' && <Clock className="w-3 h-3" />}
                          {row.status === 'PAID' && <CheckCircle2 className="w-3 h-3" />}
                          {row.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canAct ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            {row.status === 'REQUESTED' && (
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => updateStatus(row, 'APPROVED')}
                                className="px-2.5 py-1 rounded-card border border-sky-400/40 text-sky-200 hover:bg-sky-500/20 font-medium transition disabled:opacity-50"
                              >
                                Approuver
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => updateStatus(row, 'PAID')}
                              className="px-2.5 py-1 rounded-card bg-seve text-white hover:bg-seve/90 font-display font-bold transition disabled:opacity-50"
                            >
                              Marquer Payé
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => updateStatus(row, 'REJECTED')}
                              className="px-2.5 py-1 rounded-card border border-wax/50 text-rose-300 hover:bg-wax/20 font-medium transition disabled:opacity-50"
                            >
                              Rejeter
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-brume/45 font-mono">
                            {row.processedAt ? new Date(row.processedAt).toLocaleDateString('fr-FR') : 'Finalisé'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
