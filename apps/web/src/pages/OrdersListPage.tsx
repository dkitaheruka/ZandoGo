import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  CreditCard,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  FileText,
  ArrowRight,
  AlertTriangle,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import type { Order } from '../lib/types';

export function OrdersListPage() {
  const { formatPrimaryPrice, exchangeRate } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNPAID' | 'PAID' | 'COMPLETED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  // Dispute modal state
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState('PRODUCT_NOT_RECEIVED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeSending, setDisputeSending] = useState(false);

  // Invoice modal state
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Order[]>('/orders')
      .then(({ data }) => setOrders(data || []))
      .catch(() => setError('Impossible de charger vos commandes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePayOrder(orderId: string) {
    setPayingOrderId(orderId);
    setActionMessage(null);
    try {
      await api.post(`/orders/${orderId}/pay`);
      setActionMessage('Paiement validé avec succès ! Les fonds sont désormais sécurisés sous séquestre ZandoGo.');
      load();
    } catch {
      setActionMessage('Erreur lors du règlement de la commande.');
    } finally {
      setPayingOrderId(null);
    }
  }

  async function handleReleaseEscrow(orderId: string) {
    try {
      await api.post(`/orders/${orderId}/release-escrow`);
      setActionMessage('Merci ! La livraison a été confirmée et les fonds ont été débloqués au vendeur.');
      load();
    } catch {
      setActionMessage('Erreur lors de la confirmation.');
    }
  }

  async function handleSubmitDispute(e: FormEvent) {
    e.preventDefault();
    if (!disputeOrder || !disputeDescription.trim()) return;
    setDisputeSending(true);
    try {
      await api.post('/disputes', {
        orderId: disputeOrder.id,
        orderNumber: disputeOrder.orderNumber,
        reasonCategory: disputeReason,
        description: disputeDescription.trim(),
      });
      setDisputeOrder(null);
      setDisputeDescription('');
      setActionMessage(
        `Litige enregistré pour ${disputeOrder.orderNumber}. Les fonds sont gelés sous séquestre et l’équipe d’arbitrage statuera sous 48h.`,
      );
      load();
    } finally {
      setDisputeSending(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const isUnpaid = order.status === 'PENDING_PAYMENT' || order.isPaid === false;
    if (filterTab === 'UNPAID' && !isUnpaid) return false;
    if (filterTab === 'PAID' && (isUnpaid || order.status === 'COMPLETED')) return false;
    if (filterTab === 'COMPLETED' && order.status !== 'COMPLETED') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesNumber = order.orderNumber.toLowerCase().includes(q);
      const matchesProduct = order.subOrders?.some((so) =>
        so.items?.some((it) => it.productTitle?.toLowerCase().includes(q)),
      );
      return matchesNumber || matchesProduct;
    }
    return true;
  });

  const unpaidCount = orders.filter((o) => o.status === 'PENDING_PAYMENT' || o.isPaid === false).length;
  const paidCount = orders.filter((o) => o.status !== 'PENDING_PAYMENT' && o.isPaid !== false && o.status !== 'COMPLETED').length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider">
            <span className="px-3 py-0.5 rounded-full bg-seve/10 border border-seve/25 text-seve flex items-center gap-1.5 font-bold text-[10px]">
              <Package className="w-3.5 h-3.5 text-seve" />
              <span>Gestion des Commandes Acheteur</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl lg:text-3xl font-extrabold text-nuit tracking-tight">
            Vos Commandes sur ZandoGo
          </h1>
          <p className="mt-1 text-xs text-encre/60">
            Consultez vos commandes, imprimez vos reçus proforma, suivez vos coursiers GPS ou ouvrez un arbitrage séquestre.
          </p>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
        >
          <span>Parcourir le catalogue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {actionMessage && (
        <div className="mt-6 p-4 rounded-card bg-seve/10 border border-seve/25 text-xs font-medium text-seve flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-seve shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-card bg-wax/10 border border-wax/25 p-4 text-xs text-wax flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline font-semibold">
            Réessayer
          </button>
        </div>
      )}

      {/* Segmented Filter Tabs + Search */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-encre/10 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-4 py-2 rounded-card text-xs font-semibold transition ${
              filterTab === 'ALL'
                ? 'bg-nuit text-brume shadow-xs font-display'
                : 'bg-white text-encre/70 hover:bg-encre/5 border border-encre/15'
            }`}
          >
            Toutes ({orders.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('UNPAID')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-card text-xs font-semibold transition ${
              filterTab === 'UNPAID'
                ? 'bg-nuit text-safran font-display font-bold border border-safran/50 shadow-xs'
                : 'bg-white text-encre/80 hover:bg-safran/15 border border-encre/15'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-safran" />
            <span>À payer ({unpaidCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('PAID')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-card text-xs font-semibold transition ${
              filterTab === 'PAID'
                ? 'bg-seve text-brume font-display font-bold shadow-xs'
                : 'bg-white text-encre/80 hover:bg-seve/10 border border-encre/15'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Séquestre Actif ({paidCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('COMPLETED')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-card text-xs font-semibold transition ${
              filterTab === 'COMPLETED'
                ? 'bg-encre text-brume font-display font-bold shadow-xs'
                : 'bg-white text-encre/70 hover:bg-encre/5 border border-encre/15'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Clôturées</span>
          </button>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-encre/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="N° commande ou article…"
            className="w-full pl-8 pr-3 py-2 rounded-card border border-encre/15 bg-white text-xs outline-none focus:border-seve"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-card bg-encre/5 animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-8 py-20 text-center rounded-card border border-dashed border-encre/20 bg-white p-8">
          <Package className="w-12 h-12 text-encre/20 mx-auto mb-3" />
          <h3 className="text-base font-display font-semibold text-nuit">Aucune commande trouvée</h3>
          <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
            {filterTab === 'UNPAID'
              ? 'Toutes vos commandes ont été réglées avec succès !'
              : 'Vous n’avez aucune commande correspondant à ce critère.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredOrders.map((order) => {
            const isUnpaid = order.status === 'PENDING_PAYMENT' || order.isPaid === false;
            const isCompleted = order.status === 'COMPLETED';
            const isDisputed = order.status === 'DISPUTED';
            const isEscrowActive =
              !isUnpaid &&
              !isCompleted &&
              !isDisputed &&
              (order.escrowStatus === 'HELD' ||
                order.status === 'OUT_FOR_DELIVERY' ||
                order.status === 'ESCROW_HELD');

            return (
              <div
                key={order.id}
                className={`rounded-card border bg-white p-6 shadow-xs transition hover:shadow-md ${
                  isDisputed
                    ? 'border-wax/50 ring-1 ring-wax/15'
                    : isUnpaid
                    ? 'border-safran/60 ring-1 ring-safran/20'
                    : 'border-encre/10'
                }`}
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-encre/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-nuit text-base">{order.orderNumber}</span>
                      <span className="text-encre/20">·</span>
                      <span className="text-xs text-encre/60 font-mono">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-encre/70">
                      Transport :{' '}
                      <strong className="text-nuit font-display">
                        {order.deliveryOption?.name || 'Fret ZandoGo RDC'}
                      </strong>
                      {order.deliveryFee !== undefined && (
                        <span className="ml-1 text-encre/50 font-mono tabular-nums">
                          ({order.deliveryFee === 0 ? 'Frais offerts' : `+${formatPrimaryPrice(order.deliveryFee)}`})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-xl font-bold tabular-nums text-nuit">
                      {formatPrimaryPrice(order.total)}
                    </p>

                    {isDisputed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-wax bg-wax/10 border border-wax/25 px-2.5 py-0.5 rounded-full mt-1">
                        <AlertTriangle className="w-3 h-3 text-wax" />
                        <span>Litige en cours d’arbitrage</span>
                      </span>
                    ) : isUnpaid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-encre bg-safran/20 border border-safran/40 px-2.5 py-0.5 rounded-full mt-1">
                        <Clock className="w-3 h-3 text-safran" />
                        <span>Non payée — En attente</span>
                      </span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-encre/70 bg-encre/5 px-2.5 py-0.5 rounded-full mt-1">
                        <CheckCircle2 className="w-3 h-3 text-seve" />
                        <span>Clôturée & Fonds versés</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-seve bg-seve/10 border border-seve/25 px-2.5 py-0.5 rounded-full mt-1">
                        <ShieldCheck className="w-3 h-3 text-seve" />
                        <span>Payée — Séquestre Actif</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-orders & Ordered Items */}
                <div className="py-4 space-y-2">
                  {order.subOrders?.map((so) => (
                    <div key={so.id} className="text-xs text-encre/80">
                      <div className="flex items-center justify-between text-encre/60 font-medium mb-1">
                        <span>
                          Boutique : <strong className="text-nuit font-display">{so.store?.storeName}</strong>
                        </span>
                        <span className="font-mono">{so.items?.length || 1} article(s)</span>
                      </div>
                      <div className="space-y-1">
                        {so.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-brume/60 text-xs"
                          >
                            <span className="font-medium text-encre">{item.productTitle}</span>
                            <span className="font-mono text-encre/70 tabular-nums">
                              Qté : {item.quantity || 1} · {formatPrimaryPrice(item.unitPrice || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Digital Download Attachment */}
                {order.digitalDownloads && order.digitalDownloads.length > 0 && !isUnpaid && (
                  <div className="p-3.5 rounded-card bg-safran/15 border border-safran/35 flex flex-wrap items-center justify-between gap-3 my-2">
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-4 h-4 text-seve shrink-0" />
                      <div>
                        <p className="font-display font-semibold text-nuit">Document PDF prêt à être téléchargé :</p>
                        <p className="text-encre/80">{order.digitalDownloads[0].title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setActionMessage(`Téléchargement sécurisé démarré : ${order.digitalDownloads?.[0]?.fileName}`)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-semibold transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger ({order.digitalDownloads[0].fileName})</span>
                    </button>
                  </div>
                )}

                {/* Footer Action Strip */}
                <div className="pt-4 border-t border-encre/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-encre/60">
                    {isUnpaid ? (
                      <span className="text-encre font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-safran" />
                        <span>Réglez cette commande pour démarrer l’expédition.</span>
                      </span>
                    ) : (
                      <span className="text-seve font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-seve" />
                        <span>Fonds sécurisés par ZandoGo jusqu’à validation.</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-card border border-encre/15 hover:border-nuit text-xs font-semibold text-encre transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-encre/60" />
                      <span>Reçu / Facture</span>
                    </button>

                    {isUnpaid && (
                      <button
                        type="button"
                        disabled={payingOrderId === order.id}
                        onClick={() => handlePayOrder(order.id)}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>{payingOrderId === order.id ? 'Paiement…' : 'Payer maintenant'}</span>
                      </button>
                    )}

                    {isEscrowActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDisputeOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-card border border-wax/40 text-wax hover:bg-wax/10 text-xs font-semibold transition"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Litige</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReleaseEscrow(order.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-bold transition shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirmer réception</span>
                        </button>
                      </>
                    )}

                    {!isUnpaid && !isCompleted && (
                      <Link
                        to={`/orders/${order.id}/tracking`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card border border-encre/20 hover:border-seve text-xs font-semibold text-encre transition"
                      >
                        <Truck className="w-3.5 h-3.5 text-seve" />
                        <span>Suivi GPS</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Open Dispute Modal */}
      {disputeOrder && (
        <div className="fixed inset-0 z-50 bg-nuit/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitDispute}
            className="bg-white rounded-card max-w-md w-full p-6 shadow-2xl border border-encre/10 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-nuit">
                Ouvrir un litige — {disputeOrder.orderNumber}
              </h3>
              <button type="button" onClick={() => setDisputeOrder(null)} className="text-encre/40 hover:text-nuit">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-encre/65">
              Les fonds restent gelés sous séquestre pendant l’examen par l’équipe d’arbitrage ZandoGo (réponse max sous 48h).
            </p>

            <div>
              <label className="block text-xs font-semibold text-encre/80 mb-1">Motif de la réclamation</label>
              <select
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/40 px-3.5 py-2 text-xs text-nuit outline-none focus:border-seve"
              >
                <option value="PRODUCT_NOT_RECEIVED">Colis non reçu dans les délais</option>
                <option value="PRODUCT_DAMAGED">Article endommagé ou défectueux</option>
                <option value="WRONG_ITEM">Article reçu non conforme à la commande</option>
                <option value="OTHER">Autre problème commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-encre/80 mb-1">Détails & Constat *</label>
              <textarea
                required
                rows={3}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder="Décrivez précisément le problème constaté…"
                className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs text-encre outline-none focus:border-seve"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-encre/10">
              <button
                type="button"
                onClick={() => setDisputeOrder(null)}
                className="px-4 py-2 text-xs text-encre/60 hover:text-nuit font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={disputeSending || !disputeDescription.trim()}
                className="px-5 py-2 rounded-card bg-wax hover:bg-wax/90 text-white font-display font-bold text-xs transition disabled:opacity-50"
              >
                {disputeSending ? 'Envoi…' : 'Bloquer le séquestre & Soumettre'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Invoice / Proforma Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 bg-nuit/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-lg w-full p-6 shadow-2xl border border-encre/10 space-y-5">
            <div className="flex items-start justify-between border-b border-encre/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-nuit text-safran font-display font-bold text-xs flex items-center justify-center">
                    ZG
                  </span>
                  <span className="font-display font-extrabold text-base text-nuit">ZandoGo RDC</span>
                </div>
                <p className="text-[11px] font-mono text-encre/55 mt-1">
                  Bordereau Officiel · {invoiceOrder.orderNumber}
                </p>
              </div>
              <button type="button" onClick={() => setInvoiceOrder(null)} className="text-encre/40 hover:text-nuit">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-encre/60">Date d’émission :</span>
                <span className="font-mono text-nuit">
                  {new Date(invoiceOrder.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-encre/60">Taux de référence :</span>
                <span className="font-mono text-nuit">1 USD = {exchangeRate.toLocaleString('fr-FR')} CDF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-encre/60">Statut Séquestre :</span>
                <span className="font-semibold text-seve">{invoiceOrder.status}</span>
              </div>
            </div>

            <div className="border-t border-b border-encre/10 py-3 space-y-2 text-xs">
              {invoiceOrder.subOrders?.flatMap((so) => so.items || []).map((item) => (
                <div key={item.id} className="flex justify-between gap-4">
                  <span className="text-encre font-medium">
                    {item.quantity || 1} × {item.productTitle}
                  </span>
                  <span className="font-mono tabular-nums text-nuit">
                    ${((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-encre/60 pt-1">
                <span>Frais logistiques ({invoiceOrder.deliveryOption?.name || 'Standard'})</span>
                <span className="font-mono tabular-nums">${(invoiceOrder.deliveryFee || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-display font-bold text-sm text-nuit block">Total Facturé</span>
                <span className="text-[11px] font-mono text-encre/55 tabular-nums">
                  ≈ {Math.round(Number(invoiceOrder.total) * exchangeRate).toLocaleString('fr-FR')} CDF
                </span>
              </div>
              <span className="font-display text-2xl font-extrabold text-nuit tabular-nums">
                ${Number(invoiceOrder.total).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-card bg-nuit text-brume text-xs font-display font-bold hover:bg-nuit/90 transition"
              >
                <Printer className="w-4 h-4 text-safran" />
                <span>Imprimer / PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
