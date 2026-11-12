import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, ShieldCheck, ArrowRight, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Cart } from '../lib/types';

export function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCart() {
    setLoading(true);
    setError(null);
    api
      .get<Cart>('/cart')
      .then(({ data }) => setCart(data))
      .catch(() => setError('Impossible de charger le panier. Vérifiez votre connexion puis réessayez.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) loadCart();
    else setLoading(false);
  }, [user]);

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/cart/items/${itemId}`, { quantity });
      loadCart();
    } catch (reason) {
      const message = (reason as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : (message ?? 'Impossible de modifier la quantité.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/cart/items/${itemId}`);
      loadCart();
    } catch {
      setError("Impossible de retirer cet article du panier.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900">Votre panier ZandoGo</h1>
        <p className="mt-2 text-xs text-slate-500">
          <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
            Connectez-vous
          </Link>{' '}
          pour consulter votre panier et finaliser vos achats.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-20 text-slate-400 font-mono text-xs">Chargement du panier…</div>;
  }

  const items = cart?.items ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.unitPriceSnapshot) * item.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
        <ShoppingCart className="w-4 h-4 text-emerald-600" />
        <span>Panier d'Achats Sécurisé</span>
      </div>

      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Votre Panier</h1>

      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadCart} className="underline font-semibold">
            Réessayer
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8 py-20 text-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Votre panier est vide</h3>
          <p className="mt-1 text-xs text-slate-500">Découvrez nos produits physiques, guides PDF et services en RDC.</p>
          <Link
            to="/products"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 shadow-xs"
          >
            <span>Parcourir les produits</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid md:grid-cols-[1.5fr_1fr] gap-8 items-start">
          {/* Items list */}
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="h-20 w-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {item.variant?.product?.images[0] ? (
                    <img
                      src={item.variant.product.images[0].url}
                      alt={item.variant.product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs text-slate-900 truncate">
                    {item.variant?.product?.title}
                  </p>
                  <p className="font-mono text-sm font-bold text-slate-900 mt-1 tabular-nums">
                    ${Number(item.unitPriceSnapshot).toFixed(2)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ≈ {(Number(item.unitPriceSnapshot) * 2850).toLocaleString('fr-FR')} CDF
                  </span>
                </div>

                <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    disabled={busy || item.quantity <= 1}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-40"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    disabled={busy}
                    onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                    className="w-10 text-center text-xs font-mono font-bold outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={busy}
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition"
                  title="Retirer l'article"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Order Summary Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-3 border-b border-slate-100 uppercase tracking-wider text-xs">
              Récapitulatif de la commande
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Sous-total articles :</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  ${total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimation transport RDC :</span>
                <span className="font-mono text-slate-500">Calculé à l'étape suivante</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-sm block">Total estimé</span>
                <span className="text-[11px] font-mono text-slate-400">
                  ≈ {(total * 2850).toLocaleString('fr-FR')} CDF
                </span>
              </div>
              <span className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                ${total.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 text-xs transition shadow-xs flex items-center justify-center gap-2"
            >
              <span>Continuer vers le paiement sécurisé</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Paiement protégé par le séquestre bancaire ZandoGo.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
