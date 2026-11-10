import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order, OrderStatus } from '../lib/types';

const STATUS_LABEL: Record<OrderStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'En attente de paiement', className: 'bg-safran/20 text-nuit' },
  PAID: { label: 'Payée', className: 'bg-seve/15 text-seve' },
  PROCESSING: { label: 'En préparation', className: 'bg-seve/15 text-seve' },
  SHIPPED: { label: 'Expédiée', className: 'bg-seve/15 text-seve' },
  OUT_FOR_DELIVERY: { label: 'En livraison', className: 'bg-wax/15 text-wax' },
  DELIVERED: { label: 'Livrée', className: 'bg-seve text-white' },
  CANCELLED: { label: 'Annulée', className: 'bg-encre/10 text-encre/60' },
  REFUNDED: { label: 'Remboursée', className: 'bg-encre/10 text-encre/60' },
  DISPUTED: { label: 'En litige', className: 'bg-wax/20 text-wax' },
};

const TRACKABLE: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY'];

export function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Order[]>('/orders')
      .then(({ data }) => setOrders(data))
      .catch(() => setError('Impossible de charger vos commandes.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Mes commandes</h1>
      {error && (
        <div className="mt-5 text-sm text-wax" role="alert">
          {error} <button onClick={load} className="underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-encre/50">Chargement…</p>
      ) : orders.length === 0 ? (
        <p className="mt-10 text-encre/50">
          Aucune commande pour l'instant.{' '}
          <Link to="/products" className="text-seve hover:underline">
            Parcourir les produits
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((order) => {
            const status = STATUS_LABEL[order.status];
            return (
              <div key={order.id} className="border border-encre/10 p-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-encre/50 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                      {Number(order.total).toLocaleString('fr-FR')} {order.currency}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 flex-shrink-0 ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <ul className="mt-3 text-sm text-encre/60">
                  {order.subOrders.map((so) => (
                    <li key={so.id}>
                      {so.store.storeName} · {so.items.length} article{so.items.length > 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>

                {TRACKABLE.includes(order.status) && (
                  <Link
                    to={`/orders/${order.id}/tracking`}
                    className="mt-3 inline-block text-sm text-seve hover:underline"
                  >
                    Suivre la livraison
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
