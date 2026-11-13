import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  Clock,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { VendorStore, WalletSummary } from '../../lib/types';

interface VendorOrderRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  status: string;
  buyerName?: string;
  destinationCity?: string;
  isPaid?: boolean;
  total: number;
  currency: string;
  createdAt: string;
  deliveryOption?: { name: string };
  items: { id: string; quantity?: number; productTitle?: string; unitPrice?: number }[];
}

export function VendorOrdersPage() {
  const { storeId = 'store-1' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [orders, setOrders] = useState<VendorOrderRow[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Payout form
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('M-Pesa Vodacom (+243)');
  const [payoutDestination, setPayoutDestination] = useState('+243820001122');
  const [payoutSending, setPayoutSending] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`).catch(() => ({ data: null })),
      api.get<VendorOrderRow[]>(`/vendors/stores/${storeId}/orders`).catch(() => ({ data: [] })),
      api.get<WalletSummary>('/wallets/mine').catch(() => ({ data: null })),
    ])
      .then(([stRes, ordRes, walRes]) => {
        if (stRes.data) setStore(stRes.data);
        setOrders(ordRes.data || []);
        if (walRes.data) setWallet(walRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, [storeId]);

  async function updateSubOrderStatus(subOrderId: string, nextStatus: 'PROCESSING' | 'SHIPPED') {
    await api.patch(`/vendors/stores/${storeId}/orders/${subOrderId}/status`, { status: nextStatus });
    setOrders((prev) => prev.map((o) => (o.id === subOrderId ? { ...o, status: nextStatus } : o)));
    setNotice(
      nextStatus === 'PROCESSING'
        ? 'Commande passée en préparation entrepôt.'
        : 'Colis marqué comme expédié au transporteur.',
    );
    setTimeout(() => setNotice(null), 3500);
  }

  async function handleRequestPayout(e: FormEvent) {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) return;
    setPayoutSending(true);
    try {
      await api.post('/wallets/payout', {
        amountUsd: amount,
        method: payoutMethod,
        destination: payoutDestination,
      });
      setPayoutAmount('');
      setNotice(`Demande de retrait de $${amount.toFixed(2)} envoyée vers ${payoutMethod}.`);
      loadAll();
    } finally {
      setPayoutSending(false);
    }
  }

  return (
    <VendorLayout storeId={storeId} storeName={store?.storeName || 'Boutique Victoire Wax'}>
      <div className="max-w-6xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
              <ShoppingBag className="w-4 h-4 text-seve" />
              <span>Expéditions & Trésorerie Marchande</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Commandes, Expéditions & Retraits
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Préparez vos colis, confiez-les aux transporteurs ZandoGo et encaissez vos ventes débloquées par Mobile Money.
            </p>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-card bg-seve/10 border border-seve/25 text-xs font-medium text-seve flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Wallet & Payout Section */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
          <div className="p-6 rounded-card bg-nuit text-brume border border-white/10 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-safran">
                <Wallet className="w-4 h-4" />
                <span>Portefeuille Boutique</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-seve font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Séquestre Automatique
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-brume/60 block">Disponible au retrait</span>
                <p className="font-display text-2xl font-extrabold text-seve mt-1 tabular-nums">
                  ${(wallet?.availableBalanceUsd ?? 1840.5).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-brume/60 block">En cours sous séquestre</span>
                <p className="font-display text-2xl font-extrabold text-safran mt-1 tabular-nums">
                  ${(wallet?.lockedEscrowUsd ?? 91.5).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {wallet?.payouts && wallet.payouts.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-mono text-brume/50 block">Derniers retraits</span>
                {wallet.payouts.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-brume/80">
                    <span>{p.method}</span>
                    <span className="font-mono tabular-nums">
                      ${p.amountUsd.toFixed(2)} · <strong className="text-safran">{p.status}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleRequestPayout}
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-4"
          >
            <h2 className="font-display font-bold text-sm text-nuit">Demander un versement (Mobile Money / Banque)</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-encre/70 mb-1">Montant ($ USD)</label>
                <input
                  required
                  type="number"
                  min={10}
                  step="0.5"
                  placeholder="ex: 250"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2 font-display font-bold text-nuit outline-none focus:border-seve"
                />
              </div>
              <div>
                <label className="block font-semibold text-encre/70 mb-1">Canal de versement</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full rounded-card border border-encre/20 bg-brume/30 px-3 py-2 text-nuit outline-none focus:border-seve"
                >
                  <option value="M-Pesa Vodacom (+243)">M-Pesa Vodacom</option>
                  <option value="Orange Money RDC">Orange Money RDC</option>
                  <option value="Airtel Money RDC">Airtel Money RDC</option>
                  <option value="Virement Rawbank / EquityBCDC">Virement Rawbank / EquityBCDC</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-encre/70 mb-1">Numéro ou IBAN bénéficiaire</label>
              <input
                required
                value={payoutDestination}
                onChange={(e) => setPayoutDestination(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2 font-mono text-nuit outline-none focus:border-seve"
              />
            </div>

            <button
              type="submit"
              disabled={payoutSending || !payoutAmount}
              className="w-full rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold py-2.5 text-xs transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{payoutSending ? 'Traitement…' : 'Initier le retrait sécurisé'}</span>
            </button>
          </form>
        </div>

        {/* Sub-Orders Table */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-base text-nuit">
            Commandes Reçues ({orders.length})
          </h2>

          {loading ? (
            <div className="py-16 text-center font-mono text-xs text-encre/50">Chargement des commandes…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center rounded-card bg-white border border-encre/10 text-xs text-encre/60">
              Aucune commande enregistrée pour cette boutique.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-5 rounded-card bg-white border border-encre/10 shadow-xs flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold text-sm text-nuit">{ord.orderNumber}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold bg-brume text-nuit border border-encre/15">
                        {ord.status}
                      </span>
                      {ord.isPaid ? (
                        <span className="text-[10px] font-semibold text-seve bg-seve/10 px-2 py-0.5 rounded-full">
                          Payée (Séquestre)
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-encre/70 bg-safran/25 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          En attente paiement
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-encre/70">
                      Acheteur : <strong className="text-nuit">{ord.buyerName || 'Client ZandoGo'}</strong> · Destination :{' '}
                      <span className="text-seve font-medium">{ord.destinationCity || 'Kinshasa'}</span>
                    </p>

                    <div className="text-xs text-encre/65 flex flex-wrap gap-2">
                      {ord.items?.map((it) => (
                        <span key={it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brume text-[11px]">
                          <Package className="w-3 h-3 text-seve" />
                          {it.quantity || 1} × {it.productTitle}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right mr-2">
                      <span className="block text-[10px] text-encre/50 font-mono">Total</span>
                      <span className="font-display text-base font-extrabold text-nuit tabular-nums">
                        ${Number(ord.total).toFixed(2)}
                      </span>
                    </div>

                    {ord.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => updateSubOrderStatus(ord.id, 'PROCESSING')}
                        className="px-4 py-2 rounded-card bg-nuit hover:bg-nuit/90 text-brume text-xs font-display font-bold transition"
                      >
                        Préparer colis
                      </button>
                    )}

                    {(ord.status === 'PROCESSING' || ord.status === 'PENDING') && ord.isPaid && (
                      <button
                        type="button"
                        onClick={() => updateSubOrderStatus(ord.id, 'SHIPPED')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-bold transition"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Remettre au livreur</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
