import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { api } from '../lib/api';
import type { Order } from '../lib/types';

export function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNPAID' | 'PAID' | 'COMPLETED'>('ALL');
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

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

  // Filter logic
  const filteredOrders = orders.filter((order) => {
    const isUnpaid = order.status === 'PENDING_PAYMENT' || order.isPaid === false;
    if (filterTab === 'UNPAID') return isUnpaid;
    if (filterTab === 'PAID') return !isUnpaid && order.status !== 'COMPLETED';
    if (filterTab === 'COMPLETED') return order.status === 'COMPLETED';
    return true;
  });

  const unpaidCount = orders.filter((o) => o.status === 'PENDING_PAYMENT' || o.isPaid === false).length;
  const paidCount = orders.filter((o) => o.status !== 'PENDING_PAYMENT' && o.isPaid !== false && o.status !== 'COMPLETED').length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 uppercase tracking-wider">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center gap-1.5 font-bold text-[10px]">
              <Package className="w-3.5 h-3.5 text-cyan-600" />
              <span>Gestion des Commandes Acheteur</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl lg:text-3xl font-extrabold text-slate-950 tracking-tight">
            Vos Commandes sur ZandoGo
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Consultez vos commandes précédentes payées, vos règlements en attente et téléchargez vos documents PDF.
          </p>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B0F19] hover:bg-slate-900 text-cyan-300 font-semibold text-xs transition shadow-xs border border-cyan-500/30"
        >
          <span>Parcourir le catalogue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {actionMessage && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline font-semibold">
            Réessayer
          </button>
        </div>
      )}

      {/* Segmented Filter Tabs: Toutes, Non payées, Payées & Séquestrées, Clôturées */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === 'ALL'
              ? 'bg-[#0B0F19] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Toutes les commandes ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('UNPAID')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === 'UNPAID'
              ? 'bg-[#0B0F19] text-cyan-300 font-bold border border-cyan-400 shadow-xs'
              : 'bg-white text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-cyan-500" />
          <span>En attente de paiement ({unpaidCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('PAID')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === 'PAID'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Payées & Séquestre Garanti ({paidCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('COMPLETED')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === 'COMPLETED'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Livrées & Clôturées</span>
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-8 py-20 text-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Aucune commande dans cet onglet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {filterTab === 'UNPAID'
              ? 'Toutes vos commandes ont été réglées avec succès !'
              : 'Vous n’avez aucune commande correspondant à ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredOrders.map((order) => {
            const isUnpaid = order.status === 'PENDING_PAYMENT' || order.isPaid === false;
            const isCompleted = order.status === 'COMPLETED';
            const isEscrowActive =
              !isUnpaid &&
              !isCompleted &&
              (order.escrowStatus === 'HELD' ||
                order.status === 'OUT_FOR_DELIVERY' ||
                order.status === 'ESCROW_HELD');

            return (
              <div
                key={order.id}
                className={`rounded-2xl border bg-white p-6 shadow-xs transition hover:shadow-md ${
                  isUnpaid ? 'border-cyan-400/80 ring-1 ring-cyan-100' : 'border-slate-200'
                }`}
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-base">
                        {order.orderNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      Transport :{' '}
                      <strong className="text-slate-900">
                        {order.deliveryOption?.name || 'Fret ZandoGo RDC'}
                      </strong>
                      {order.deliveryFee !== undefined && (
                        <span className="ml-1 text-slate-400 font-mono tabular-nums">
                          ({order.deliveryFee === 0 ? 'Frais offerts' : `+${order.deliveryFee} ${order.currency}`})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-xl font-bold tabular-nums text-slate-900">
                      ${Number(order.total).toFixed(2)}
                    </p>

                    {/* Payment / Order Status Badge */}
                    {isUnpaid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-900 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full mt-1">
                        <Clock className="w-3 h-3 text-cyan-600" />
                        <span>Non payée — En attente</span>
                      </span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full mt-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        <span>Clôturée & Fonds versés</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mt-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Payée — Séquestre Actif</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-orders & Ordered Items */}
                <div className="py-4 space-y-2">
                  {order.subOrders?.map((so) => (
                    <div key={so.id} className="text-xs text-slate-700">
                      <div className="flex items-center justify-between text-slate-500 font-medium mb-1">
                        <span>Boutique : <strong className="text-slate-900">{so.store?.storeName}</strong></span>
                        <span className="font-mono">{so.items?.length || 1} article(s)</span>
                      </div>
                      <div className="space-y-1">
                        {so.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs"
                          >
                            <span className="font-medium text-slate-800">{item.productTitle}</span>
                            <span className="font-mono text-slate-600 tabular-nums">
                              Qté : {item.quantity || 1} · ${(Number(item.unitPrice) || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Digital Download Attachment (PDF) */}
                {order.digitalDownloads && order.digitalDownloads.length > 0 && !isUnpaid && (
                  <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-3 my-2">
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
                      <div>
                        <p className="font-semibold text-indigo-900">Document PDF prêt à être téléchargé :</p>
                        <p className="text-indigo-700">{order.digitalDownloads[0].title}</p>
                      </div>
                    </div>
                    <a
                      href={order.digitalDownloads[0].downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger ({order.digitalDownloads[0].fileName})</span>
                    </a>
                  </div>
                )}

                {/* Footer Action Strip */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  {/* Trust note */}
                  <div className="text-xs text-slate-500">
                    {isUnpaid ? (
                      <span className="text-cyan-950 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Réglez cette commande pour démarrer la préparation par le vendeur.</span>
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Fonds sécurisés par ZandoGo jusqu’à validation de remise.</span>
                      </span>
                    )}
                  </div>

                  {/* Contextual Buttons */}
                  <div className="flex items-center gap-3">
                    {/* Pay Button for Unpaid Orders */}
                    {isUnpaid && (
                      <button
                        type="button"
                        disabled={payingOrderId === order.id}
                        onClick={() => handlePayOrder(order.id)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>
                          {payingOrderId === order.id ? 'Paiement en cours…' : 'Payer maintenant'}
                        </span>
                      </button>
                    )}

                    {/* Escrow Release Button */}
                    {isEscrowActive && (
                      <button
                        type="button"
                        onClick={() => handleReleaseEscrow(order.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmer réception (Débloquer les fonds)</span>
                      </button>
                    )}

                    {/* Tracking Button */}
                    {!isUnpaid && !isCompleted && (
                      <Link
                        to={`/orders/${order.id}/tracking`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                      >
                        <Truck className="w-3.5 h-3.5 text-slate-500" />
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
    </div>
  );
}
