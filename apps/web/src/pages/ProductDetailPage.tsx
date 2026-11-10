import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Product } from '../lib/types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contactError, setContactError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/products/${id}`).then(({ data }) => {
      setProduct(data);
      setVariantId(data.variants[0]?.id ?? '');
    });
  }, [id]);

  async function handleAddToCart() {
    if (!user) {
      setStatus('error');
      return;
    }
    setStatus('adding');
    try {
      await api.post('/cart/items', { productVariantId: variantId, quantity });
      setStatus('added');
    } catch {
      setStatus('error');
    }
  }

  if (!product) return <div className="mx-auto max-w-6xl px-6 py-20 text-encre/50">Chargement…</div>;

  const selectedVariant = product.variants.find((v) => v.id === variantId);
  const price = selectedVariant?.priceOverride ?? product.basePriceUsd;
  const outOfStock = (selectedVariant?.stockQty ?? 0) <= 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 grid md:grid-cols-2 gap-12">
      <div className="aspect-square bg-brume rounded-card overflow-hidden flex items-center justify-center">
        {product.images[0] ? (
          <img src={product.images[0].url} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-encre/30">Pas d'image</span>
        )}
      </div>

      <div>
        {product.store && <p className="text-sm text-encre/50">{product.store.storeName}</p>}
        <h1 className="font-display text-3xl font-semibold mt-1">{product.title}</h1>
        <p className="mt-4 font-display text-2xl font-semibold">{price.toLocaleString('fr-FR')} $</p>

        {product.description && (
          <p className="mt-6 text-encre/70 leading-relaxed max-w-md">{product.description}</p>
        )}

        {product.variants.length > 1 && (
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Variante</label>
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.attributes ? Object.values(v.attributes).join(' / ') : v.sku}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 flex items-center gap-4">
          <label className="text-sm font-medium" htmlFor="quantity">
            Quantité
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-lg border border-encre/20 px-3 py-2 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
          />
        </div>

        {outOfStock ? (
          <p className="mt-8 text-wax font-medium">Rupture de stock pour cette variante.</p>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={status === 'adding'}
            className="mt-8 rounded-full bg-seve text-white font-medium px-8 py-3 hover:bg-seve/90 transition-colors disabled:opacity-60"
          >
            {status === 'adding' ? 'Ajout…' : status === 'added' ? 'Ajouté au panier ✓' : 'Ajouter au panier'}
          </button>
        )}

        {status === 'error' && !user && (
          <p className="mt-3 text-sm text-wax">Connectez-vous pour ajouter un article au panier.</p>
        )}

        {product.store?.ownerId && user?.id !== product.store.ownerId && (
          <div className="mt-6 pt-6 border-t border-encre/10">
            <button
              onClick={async () => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                setContactError(null);
                try {
                  const { data } = await api.post<{ id: string }>('/chat/conversations', {
                    type: 'CUSTOMER_VENDOR',
                    otherUserId: product.store!.ownerId,
                  });
                  navigate('/chat', { state: { conversationId: data.id } });
                } catch {
                  setContactError("Impossible d'ouvrir la conversation. Réessayez.");
                }
              }}
              className="text-sm text-seve hover:underline"
            >
              Contacter le vendeur
            </button>
            {contactError && <p className="mt-2 text-sm text-wax">{contactError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
