import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ShoppingCart, Trash2, Plus, Minus, ShieldCheck, ArrowRight, Package, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import { useAuth } from '../lib/auth-context';

export function CartDrawer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    cart,
    cartCount,
    cartSubtotalUsd,
    isCartOpen,
    closeCart,
    refreshCart,
    formatPrimaryPrice,
    formatSecondaryPrice,
  } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const items = cart?.items ?? [];
  const freeUrbanThreshold = 150;
  const remainingForPerk = Math.max(0, freeUrbanThreshold - cartSubtotalUsd);
  const progressPct = Math.min(100, Math.round((cartSubtotalUsd / freeUrbanThreshold) * 100));

  async function updateQty(itemId: string, nextQty: number) {
    if (nextQty < 1) return;
    setBusyId(itemId);
    try {
      await api.patch(`/cart/items/${itemId}`, { quantity: nextQty });
      await refreshCart();
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyId(itemId);
    try {
      await api.delete(`/cart/items/${itemId}`);
      await refreshCart();
    } finally {
      setBusyId(null);
    }
  }

  function goTo(path: string) {
    closeCart();
    navigate(path);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-nuit/65 backdrop-blur-xs transition-opacity"
        onClick={closeCart}
        aria-hidden="true"
      />

      <aside className="relative z-10 w-full max-w-md bg-brume text-encre h-full flex flex-col shadow-2xl border-l border-encre/15">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-encre/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-card bg-nuit text-safran flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-nuit">
                Panier Rapide ({cartCount})
              </h2>
              <p className="text-[11px] text-encre/55">Séquestre ZandoGo actif</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="p-1.5 rounded-lg text-encre/50 hover:text-nuit hover:bg-encre/5 transition"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Express Delivery Progress Bar */}
        {user && items.length > 0 && (
          <div className="px-6 py-3 bg-white/80 border-b border-encre/10 text-[11px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 font-medium text-encre/80">
                <Truck className="w-3.5 h-3.5 text-seve" />
                {remainingForPerk === 0 ? (
                  <span className="text-seve font-semibold">Livraison urbaine prioritaire débloquée !</span>
                ) : (
                  <span>
                    Plus que <strong className="text-nuit tabular-nums">{formatPrimaryPrice(remainingForPerk)}</strong> pour livraison express offerte
                  </span>
                )}
              </span>
              <span className="font-mono text-encre/50 tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-encre/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-seve transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!user ? (
            <div className="py-16 text-center rounded-card bg-white border border-encre/10 p-6">
              <ShoppingCart className="w-10 h-10 text-encre/25 mx-auto mb-3" />
              <p className="font-display font-semibold text-sm text-nuit">Connectez-vous pour gérer votre panier</p>
              <button
                type="button"
                onClick={() => goTo('/login')}
                className="mt-4 px-5 py-2.5 rounded-card bg-seve text-brume text-xs font-display font-bold hover:bg-seve/90 transition"
              >
                Se connecter
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center rounded-card bg-white border border-dashed border-encre/20 p-6">
              <Package className="w-10 h-10 text-encre/25 mx-auto mb-3" />
              <p className="font-display font-semibold text-sm text-nuit">Votre panier est vide</p>
              <p className="text-xs text-encre/60 mt-1">
                Ajoutez des articles physiques, documents PDF ou services depuis le catalogue.
              </p>
              <button
                type="button"
                onClick={() => goTo('/products')}
                className="mt-4 px-5 py-2.5 rounded-card bg-seve text-brume text-xs font-display font-bold hover:bg-seve/90 transition"
              >
                Parcourir le catalogue
              </button>
            </div>
          ) : (
            items.map((item) => {
              const isKm = item.variant?.product?.pricingUnit === 'KM';
              return (
                <div
                  key={item.id}
                  className="rounded-card bg-white border border-encre/10 p-3.5 flex gap-3 shadow-xs"
                >
                  <div className="h-16 w-16 rounded-xl bg-brume overflow-hidden shrink-0 flex items-center justify-center">
                    {item.variant?.product?.images?.[0] ? (
                      <img
                        src={item.variant.product.images[0].url}
                        alt={item.variant.product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-encre/25" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={item.variant?.product?.id ? `/products/${item.variant.product.id}` : '/products'}
                      onClick={closeCart}
                      className="font-bold text-xs text-nuit hover:text-seve line-clamp-2 leading-snug"
                    >
                      {item.variant?.product?.title}
                    </Link>

                    {item.variant?.name && (
                      <p className="text-[10px] text-encre/60 mt-0.5 truncate">{item.variant.name}</p>
                    )}

                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-sm font-bold text-nuit tabular-nums">
                        {formatPrimaryPrice(item.unitPriceSnapshot)}
                        {isKm ? ' / km' : ''}
                      </span>
                      <span className="text-[10px] font-mono text-encre/45 tabular-nums">
                        {formatSecondaryPrice(item.unitPriceSnapshot)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center border border-encre/15 rounded-lg bg-brume/60">
                        <button
                          type="button"
                          disabled={busyId === item.id || item.quantity <= 1}
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="p-1.5 text-encre/70 hover:text-nuit disabled:opacity-35"
                          aria-label="Diminuer la quantité"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-display font-bold tabular-nums">
                          {item.quantity}{isKm ? ' km' : ''}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="p-1.5 text-encre/70 hover:text-nuit disabled:opacity-35"
                          aria-label="Augmenter la quantité"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-lg text-encre/40 hover:text-wax hover:bg-wax/10 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {user && items.length > 0 && (
          <div className="p-5 bg-white border-t border-encre/10 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold text-encre/70 block">Sous-total estimé</span>
                <span className="text-[10px] font-mono text-encre/50 tabular-nums">
                  {formatSecondaryPrice(cartSubtotalUsd)}
                </span>
              </div>
              <span className="font-display text-xl font-extrabold text-nuit tabular-nums">
                {formatPrimaryPrice(cartSubtotalUsd)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => goTo('/cart')}
                className="rounded-card border border-encre/20 bg-brume/60 hover:bg-encre/5 text-nuit font-display font-semibold py-3 text-xs transition"
              >
                Voir le panier
              </button>
              <button
                type="button"
                onClick={() => goTo('/checkout')}
                className="rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold py-3 text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Commander</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-seve font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Fonds protégés jusqu’à la livraison conforme</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
