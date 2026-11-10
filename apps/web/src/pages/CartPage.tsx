import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
        <h1 className="font-display text-2xl font-semibold">Votre panier</h1>
        <p className="mt-3 text-encre/60">
          <Link to="/login" className="text-seve hover:underline">
            Connectez-vous
          </Link>{' '}
          pour voir votre panier.
        </p>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-4xl px-6 py-20 text-encre/50">Chargement…</div>;

  const items = cart?.items ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.unitPriceSnapshot) * item.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Votre panier</h1>
      {error && (
        <div className="mt-5 text-sm text-wax" role="alert">
          {error} <button onClick={loadCart} className="underline">Réessayer</button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-8 text-encre/50">
          Votre panier est vide.{' '}
          <Link to="/products" className="text-seve hover:underline">
            Parcourir les produits
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-card border border-encre/10 p-4">
              <div className="h-20 w-20 bg-brume rounded-lg overflow-hidden flex-shrink-0">
                {item.variant.product.images[0] && (
                  <img
                    src={item.variant.product.images[0].url}
                    alt={item.variant.product.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1">
                <p className="font-medium">{item.variant.product.title}</p>
                <p className="text-sm text-encre/50">
                  {Number(item.unitPriceSnapshot).toLocaleString('fr-FR')} $
                </p>
              </div>

              <input
                type="number"
                min={1}
                value={item.quantity}
                disabled={busy}
                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                className="w-16 rounded-lg border border-encre/20 px-2 py-1.5 text-center"
              />

              <button disabled={busy} onClick={() => removeItem(item.id)} className="text-sm text-wax hover:underline disabled:opacity-50">
                {busy ? 'Mise à jour…' : 'Retirer'}
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between pt-6 border-t border-encre/10">
            <span className="font-display text-xl font-semibold">
              Total : {total.toLocaleString('fr-FR')} $
            </span>
            <button
              onClick={() => navigate('/checkout')}
              className="rounded-full bg-nuit text-brume font-medium px-8 py-3 hover:bg-nuit/90 transition-colors"
            >
              Passer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
