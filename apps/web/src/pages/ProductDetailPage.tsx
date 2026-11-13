import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Package,
  Handshake,
  MessageSquare,
  Check,
  FileText,
  Sparkles,
  Truck,
  X,
  Heart,
  Scale,
  Star,
  Calculator,
  ShoppingCart,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import type { Product, ProductReview } from '../lib/types';

const CITY_SHIPPING_BASE: Record<string, { label: string; expressUsd: number; freightUsd: number }> = {
  Kinshasa: { label: 'Kinshasa (Coursier Moto)', expressUsd: 6.5, freightUsd: 0 },
  Lubumbashi: { label: 'Lubumbashi (Haut-Katanga)', expressUsd: 14, freightUsd: 8 },
  Goma: { label: 'Goma (Nord-Kivu)', expressUsd: 15, freightUsd: 9 },
  Matadi: { label: 'Matadi (Kongo-Central)', expressUsd: 10, freightUsd: 6 },
  Kisangani: { label: 'Kisangani (Tshopo)', expressUsd: 16, freightUsd: 10 },
};

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    formatPrimaryPrice,
    formatSecondaryPrice,
    refreshCart,
    openCart,
    isWishlisted,
    toggleWishlist,
    compareProducts,
    toggleCompare,
    exchangeRate,
  } = useStore();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [contactError, setContactError] = useState<string | null>(null);

  // Landed Cost Simulator
  const [simCity, setSimCity] = useState<string>('Kinshasa');
  const [simPickup, setSimPickup] = useState<'EXPRESS' | 'FREIGHT' | 'PICKUP'>('EXPRESS');

  // Reviews
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Negotiation & Transport Discussion State
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(1);
  const [targetCity, setTargetCity] = useState('Kinshasa');
  const [targetTransportMode, setTargetTransportMode] = useState('Coursier Express Ville (Rapide)');
  const [targetDeliveryFee, setTargetDeliveryFee] = useState<number>(3.5);
  const [negotiationNote, setNegotiationNote] = useState('');
  const [negotiationSubmitting, setNegotiationSubmitting] = useState(false);
  const [negotiationSuccess, setNegotiationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/products/${id}`).then(({ data }) => {
      setProduct(data);
      setVariantId(data.variants[0]?.id ?? '');
      const base = Number(data.basePriceUsd);
      setTargetPrice(base);
      setTargetQty(1);
    });
    api
      .get<ProductReview[]>(`/products/${id}/reviews`)
      .then(({ data }) => setReviews(data || []))
      .catch(() => {});
  }, [id]);

  if (!product) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-encre/50 font-mono text-xs">Chargement de l’offre…</div>;
  }

  const selectedVariant = product.variants.find((v) => v.id === variantId) || product.variants[0];

  // Dynamic Volume Tiered Pricing Calculation
  const baseUnitPrice = Number(selectedVariant?.priceOverride ?? product.basePriceUsd);
  let activeUnitPrice = baseUnitPrice;
  if (product.priceTiers && product.priceTiers.length > 0) {
    const matchedTier = product.priceTiers
      .slice()
      .reverse()
      .find((t) => quantity >= t.minQty && (t.maxQty === null || t.maxQty === undefined || quantity <= t.maxQty));
    if (matchedTier) {
      activeUnitPrice = matchedTier.unitPriceUsd;
    }
  }

  const isPhysical = product.productType === 'PHYSICAL';
  const isDigital = product.productType === 'DIGITAL';
  const isService = product.productType === 'SERVICE';
  const stockAvailable = selectedVariant?.stockQty ?? product.stockQty ?? 0;
  const outOfStock = isPhysical && stockAvailable <= 0;
  const isLowStock = isPhysical && stockAvailable > 0 && stockAvailable <= (product.lowStockThreshold || 5);

  const cityCfg = CITY_SHIPPING_BASE[simCity] || CITY_SHIPPING_BASE.Kinshasa;
  const simShippingUsd = isDigital
    ? 0
    : simPickup === 'PICKUP'
    ? 0
    : simPickup === 'FREIGHT'
    ? cityCfg.freightUsd || cityCfg.expressUsd
    : cityCfg.expressUsd;
  const simTotalUsd = activeUnitPrice * quantity + simShippingUsd;
  const unitSavingsUsd = Math.max(0, baseUnitPrice - activeUnitPrice);
  const totalSavingsUsd = unitSavingsUsd * quantity;

  const wishlisted = isWishlisted(product.id);
  const compared = compareProducts.some((p) => p.id === product.id);
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : product.rating ?? product.store.rating ?? 4.9;

  async function handleAddToCart() {
    if (!user) {
      navigate('/login');
      return;
    }
    setStatus('adding');
    try {
      await api.post('/cart/items', { productVariantId: variantId, quantity });
      await refreshCart();
      setStatus('added');
    } catch {
      setStatus('error');
    }
  }

  async function handleSendNegotiation(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setNegotiationSubmitting(true);
    setNegotiationSuccess(null);
    try {
      await api.post('/negotiations', {
        productId: product?.id,
        productTitle: product?.title,
        productImage: product?.images[0]?.url,
        storeId: product?.store?.id || 'store-1',
        storeName: product?.store?.storeName,
        requestedQty: targetQty,
        requestedPriceUsd: targetPrice,
        transportMode: targetTransportMode,
        requestedDeliveryFeeUsd: targetDeliveryFee,
        currency: 'USD',
        notes: negotiationNote,
        destinationCity: targetCity,
      });
      setNegotiationSuccess(
        `Proposition envoyée ! $${targetPrice}/unité (${targetQty} pcs) avec transport "${targetTransportMode}" à $${targetDeliveryFee} pour ${targetCity}. Redirection vers la messagerie…`,
      );
      setTimeout(() => {
        setNegotiationOpen(false);
        setNegotiationSuccess(null);
        navigate('/chat');
      }, 1500);
    } catch {
      setNegotiationSuccess('Erreur lors de l’envoi de la négociation.');
    } finally {
      setNegotiationSubmitting(false);
    }
  }

  async function handleSubmitReview(e: FormEvent) {
    e.preventDefault();
    if (!reviewComment.trim() || !product) return;
    setReviewSaving(true);
    try {
      const { data } = await api.post<ProductReview>(`/products/${product.id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviews((prev) => [data, ...prev]);
      setReviewComment('');
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-encre/60 font-medium">
          <Link to="/" className="hover:text-seve">Accueil</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-seve">Catalogue ZandoGo</Link>
          <span>/</span>
          <span className="text-nuit font-semibold truncate max-w-sm">{product.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border text-xs font-semibold transition ${
              wishlisted
                ? 'bg-wax text-white border-wax'
                : 'bg-white text-encre/80 border-encre/15 hover:border-wax/50'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-white' : 'text-wax'}`} />
            <span>{wishlisted ? 'Enregistré' : 'Favoris'}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleCompare(product)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border text-xs font-semibold transition ${
              compared
                ? 'bg-safran text-nuit border-safran'
                : 'bg-white text-encre/80 border-encre/15 hover:border-seve'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{compared ? 'Dans le comparateur' : 'Comparer'}</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-start">
        {/* Left: Product Media Gallery + Escrow + Landed Cost Simulator */}
        <div className="space-y-4">
          <div className="rounded-card border border-encre/10 bg-white overflow-hidden shadow-xs relative">
            <div className="aspect-[4/3] bg-brume flex items-center justify-center overflow-hidden">
              {product.images[0] ? (
                <img
                  src={product.images[0].url}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="w-16 h-16 text-encre/20" />
              )}
            </div>

            <div className="absolute top-4 left-4 bg-nuit/90 backdrop-blur-md text-brume text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              {isPhysical && (
                <>
                  <Package className="w-3.5 h-3.5 text-seve" />
                  <span>Bien matériel avec stock</span>
                </>
              )}
              {isDigital && (
                <>
                  <FileText className="w-3.5 h-3.5 text-safran" />
                  <span>Téléchargement PDF instantané</span>
                </>
              )}
              {isService && (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-safran" />
                  <span>Prestation de service & réseau</span>
                </>
              )}
            </div>
          </div>

          {/* Guarantee & Escrow Card */}
          <div className="rounded-card border border-white/10 bg-nuit text-brume p-5 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-seve font-display font-semibold">
                <ShieldCheck className="w-4 h-4 text-seve" />
                <span>Protection Séquestre ZandoGo 100%</span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-safran bg-safran/20 px-2 py-0.5 rounded border border-safran/35">
                Garantie RDC
              </span>
            </div>
            <p className="text-brume/75 leading-relaxed text-[11px]">
              Fonds bloqués sous séquestre sécurisé. Le vendeur n’est crédité qu’après confirmation de livraison et d’inspection conforme de votre part.
            </p>
          </div>

          {/* Interactive B2B / RDC Landed Cost Simulator */}
          <div className="rounded-card border border-encre/10 bg-white p-5 text-xs space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-bold text-nuit">
                <Calculator className="w-4 h-4 text-seve" />
                <span>Simulateur Coût Rendu RDC</span>
              </div>
              <span className="text-[10px] font-mono text-encre/50">1 USD = {exchangeRate.toLocaleString('fr-FR')} CDF</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-encre/70 mb-1">Ville de livraison</label>
                <select
                  value={simCity}
                  onChange={(e) => setSimCity(e.target.value)}
                  className="w-full rounded-lg border border-encre/15 bg-brume/50 px-3 py-1.5 text-xs font-medium text-nuit outline-none focus:border-seve"
                >
                  {Object.entries(CITY_SHIPPING_BASE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-encre/70 mb-1">Mode d’acheminement</label>
                <select
                  value={simPickup}
                  onChange={(e) => setSimPickup(e.target.value as 'EXPRESS' | 'FREIGHT' | 'PICKUP')}
                  disabled={isDigital}
                  className="w-full rounded-lg border border-encre/15 bg-brume/50 px-3 py-1.5 text-xs font-medium text-nuit outline-none focus:border-seve disabled:opacity-50"
                >
                  <option value="EXPRESS">Coursier Express</option>
                  <option value="FREIGHT">Fret National / Agence</option>
                  <option value="PICKUP">Retrait en boutique ($0)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-encre/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-encre/60 block">
                  {quantity} × {formatPrimaryPrice(activeUnitPrice)} + transport ({formatPrimaryPrice(simShippingUsd)})
                </span>
                {totalSavingsUsd > 0 && (
                  <span className="text-[11px] font-display font-bold text-seve">
                    Économie volume : {formatPrimaryPrice(totalSavingsUsd)} !
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-encre/50 block">Total rendu estimé</span>
                <span className="font-display text-lg font-extrabold text-nuit tabular-nums">
                  {formatPrimaryPrice(simTotalUsd)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Pricing, Tiers, Vendor & Purchase Module */}
        <div className="space-y-6">
          {/* Supplier Lockup */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-encre/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-nuit">{product.store.storeName}</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-seve/10 text-seve border border-seve/25 font-semibold text-[10px]">
                <ShieldCheck className="w-3 h-3 text-seve" />
                <span>Fournisseur Agréé</span>
              </span>
              <span className="text-encre/50">· {product.store.city || 'Kinshasa (RDC)'}</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                try {
                  const { data } = await api.post<{ id: string }>('/chat/conversations', {
                    type: 'CUSTOMER_VENDOR',
                    storeId: product.store?.id || 'store-1',
                    storeName: product.store?.storeName,
                    productId: product.id,
                    productTitle: product.title,
                    productImage: product.images[0]?.url,
                    productPriceUsd: Number(product.basePriceUsd),
                    otherUserId: product.store!.ownerId || 'usr-1',
                  });
                  navigate('/chat', { state: { conversationId: data.id } });
                } catch {
                  setContactError('Impossible d’ouvrir le chat.');
                }
              }}
              className="inline-flex items-center gap-1 text-encre/70 hover:text-seve font-semibold text-xs transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-encre/40" />
              <span>Contacter le vendeur</span>
            </button>
          </div>
          {contactError && (
            <p className="text-xs text-wax bg-wax/10 border border-wax/25 px-3 py-1.5 rounded-card">
              {contactError}
            </p>
          )}

          {/* Title + Rating */}
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-nuit leading-tight">
              {product.title}
            </h1>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 font-display font-bold text-nuit tabular-nums">
                <Star className="w-4 h-4 text-safran fill-safran" />
                {avgRating.toFixed(1)} / 5
              </span>
              <span className="text-encre/50">·</span>
              <a href="#reviews-section" className="text-seve hover:underline font-medium">
                {reviews.length > 0 ? `${reviews.length} avis vérifié(s)` : `${product.reviewCount || 12} achats vérifiés`}
              </a>
            </div>
          </div>

          {/* Tiered Bulk Pricing Table */}
          {product.priceTiers && product.priceTiers.length > 0 ? (
            <div className="rounded-card border border-encre/10 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-display font-semibold text-nuit uppercase tracking-wider text-[11px]">
                  Tarifs selon quantité (Vente au détail & gros)
                </span>
                <span className="text-[11px] font-display text-encre font-semibold bg-safran/20 px-2.5 py-0.5 rounded-md border border-safran/40">
                  Prix dynamique appliqué
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {product.priceTiers.map((tier, idx) => {
                  const isActive =
                    quantity >= tier.minQty &&
                    (tier.maxQty === null || tier.maxQty === undefined || quantity <= tier.maxQty);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setQuantity(tier.minQty)}
                      className={`p-3 rounded-card border transition text-center ${
                        isActive
                          ? 'border-seve bg-seve/5 shadow-xs ring-1 ring-seve/30'
                          : 'border-encre/10 bg-brume/50 hover:border-seve/40'
                      }`}
                    >
                      <p className="text-[11px] font-sans text-encre/60">
                        {tier.maxQty ? `${tier.minQty} - ${tier.maxQty} pcs` : `${tier.minQty}+ pcs`}
                      </p>
                      <p className="text-base font-display font-bold text-nuit mt-1 tabular-nums">
                        {formatPrimaryPrice(tier.unitPriceUsd)}
                      </p>
                      <span className="text-[10px] text-encre/50 font-mono tabular-nums">
                        {formatSecondaryPrice(tier.unitPriceUsd)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-card bg-white border border-encre/10 flex items-baseline gap-3">
              <span className="font-display text-3xl font-extrabold text-nuit tabular-nums">
                {formatPrimaryPrice(activeUnitPrice)}
              </span>
              <span className="text-xs font-mono text-encre/60 tabular-nums">
                ({formatSecondaryPrice(activeUnitPrice)})
              </span>
            </div>
          )}

          {/* Offering Meta Modules */}
          {isDigital && (
            <div className="p-4 rounded-card bg-safran/15 border border-safran/35 text-xs text-encre">
              <p className="font-display font-semibold text-nuit uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-seve" />
                <span>Téléchargement Numérique Garanti</span>
              </p>
              <p className="text-encre/80 mt-1 leading-relaxed">
                Fichier PDF ({product.digitalFileSize || '18 Mo'}). Dès validation du paiement, le lien de téléchargement s’active instantanément dans votre espace commandes.
              </p>
            </div>
          )}

          {isService && (
            <div className="p-4 rounded-card bg-safran/15 border border-safran/35 text-xs text-encre">
              <p className="font-display font-semibold text-nuit uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-seve" />
                <span>Prestation & Mise en Service</span>
              </p>
              <p className="text-encre/80 mt-1 leading-relaxed">
                {product.serviceDuration || 'Intervention sous 24h'}. {product.fulfillmentDetails || 'Prise de contact téléphonique du technicien dans les 2 heures.'}
              </p>
            </div>
          )}

          {isPhysical && (
            <div className="p-3.5 rounded-card bg-white border border-encre/10 text-xs flex items-center justify-between">
              <span className="text-encre/70 font-medium">Stock entrepôt :</span>
              {outOfStock ? (
                <span className="font-semibold text-wax">Rupture de stock temporaire</span>
              ) : isLowStock ? (
                <span className="font-semibold text-wax bg-wax/10 border border-wax/25 px-2 py-0.5 rounded-md font-sans tabular-nums">
                  Dernières {stockAvailable} unités en stock
                </span>
              ) : (
                <span className="font-semibold text-seve font-sans tabular-nums">
                  {stockAvailable} unités disponibles immédiatement
                </span>
              )}
            </div>
          )}

          {product.description && (
            <p className="text-xs text-encre/75 leading-relaxed pt-1">
              {product.description}
            </p>
          )}

          {/* Variants Selector */}
          {product.variants.length > 1 && (
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/60 mb-2">
                Modèle / Option
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`px-3.5 py-2 rounded-card text-xs font-medium border transition ${
                      variantId === v.id
                        ? 'border-nuit bg-nuit text-brume font-display font-bold shadow-xs'
                        : 'border-encre/15 bg-white text-encre/80 hover:border-seve'
                    }`}
                  >
                    {v.name || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector + Total */}
          {isPhysical && (
            <div className="flex items-center justify-between p-3.5 rounded-card bg-white border border-encre/10">
              <div className="flex items-center gap-3">
                <label htmlFor="qty-input" className="text-xs font-semibold text-encre/80">
                  Quantité commandée :
                </label>
                <div className="flex items-center border border-encre/20 rounded-lg bg-brume/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2.5 py-1 text-encre/70 hover:bg-encre/10 font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    id="qty-input"
                    type="number"
                    min={1}
                    max={stockAvailable || 999}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-12 text-center text-xs font-display font-bold outline-none bg-transparent text-encre"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-2.5 py-1 text-encre/70 hover:bg-encre/10 font-bold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-encre/50 block font-sans">Sous-total estimé</span>
                <span className="font-display text-base font-bold text-nuit tabular-nums">
                  {formatPrimaryPrice(activeUnitPrice * quantity)}
                </span>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-3">
              {outOfStock ? (
                <button
                  disabled
                  className="w-full rounded-card bg-encre/10 text-encre/40 font-medium py-3.5 text-xs cursor-not-allowed"
                >
                  Article temporairement épuisé
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={status === 'adding'}
                  className="flex-1 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold py-3.5 text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  {status === 'adding' ? (
                    <span>Ajout au panier…</span>
                  ) : status === 'added' ? (
                    <>
                      <Check className="w-4 h-4 text-brume" />
                      <span>Ajouté au panier !</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 text-brume" />
                      <span>{isDigital ? 'Acheter & Télécharger' : isService ? 'Commander la prestation' : 'Ajouter au panier'}</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setNegotiationOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-card bg-nuit hover:bg-nuit/90 text-safran border border-safran/40 hover:border-safran font-display font-bold text-xs transition shadow-xs"
              >
                <Handshake className="w-4 h-4 text-safran" />
                <span>Discuter & Négocier (Prix & Transport)</span>
              </button>
            </div>

            {status === 'added' && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-card bg-seve/10 border border-seve/30 text-xs">
                <span className="text-seve font-medium">Article ajouté avec succès.</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={openCart} className="font-semibold text-seve underline">
                    Panier rapide
                  </button>
                  <button type="button" onClick={() => navigate('/checkout')} className="font-semibold text-nuit underline">
                    Paiement &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verified Reviews Section */}
      <section id="reviews-section" className="mt-16 pt-10 border-t border-encre/10 grid lg:grid-cols-[1.2fr_0.9fr] gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-nuit">Avis & Retours d’Expérience</h2>
              <p className="text-xs text-encre/60">Commentaires d’acheteurs ayant confirmé la livraison sous séquestre.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-card bg-white border border-encre/10">
              <Star className="w-4 h-4 text-safran fill-safran" />
              <span className="font-display font-bold text-sm text-nuit tabular-nums">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-encre/50">/ 5</span>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="p-6 rounded-card bg-white border border-encre/10 text-xs text-encre/60">
              Aucun avis détaillé publié pour le moment. Soyez le premier acheteur à partager votre retour ci-contre.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-card bg-white border border-encre/10 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-xs text-nuit">{rev.authorName}</span>
                      {rev.city && <span className="text-[11px] text-encre/50">· {rev.city}</span>}
                      {rev.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seve/10 text-seve text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3" />
                          Achat vérifié
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-3.5 h-3.5 ${n <= rev.rating ? 'text-safran fill-safran' : 'text-encre/20'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-encre/80 leading-relaxed">{rev.comment}</p>
                  <p className="mt-1.5 text-[10px] font-mono text-encre/40">
                    {new Date(rev.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Review Form */}
        <form onSubmit={handleSubmitReview} className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-4 h-fit">
          <h3 className="font-display font-bold text-sm text-nuit">Laisser un avis sur cette offre</h3>
          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1.5">Note attribuée</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className="p-1 hover:scale-110 transition-transform"
                  aria-label={`${n} étoiles`}
                >
                  <Star className={`w-5 h-5 ${n <= reviewRating ? 'text-safran fill-safran' : 'text-encre/20'}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1.5">Votre commentaire</label>
            <textarea
              required
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Qualité du produit, délai de livraison, relation avec le vendeur…"
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2.5 text-xs text-encre outline-none focus:border-seve"
            />
          </div>

          <button
            type="submit"
            disabled={reviewSaving || !reviewComment.trim()}
            className="w-full rounded-card bg-nuit hover:bg-nuit/90 text-brume font-display font-bold py-2.5 text-xs transition disabled:opacity-50"
          >
            {reviewSaving ? 'Publication…' : 'Publier mon avis'}
          </button>
        </form>
      </section>

      {/* Discussion & Negotiation Modal */}
      {negotiationOpen && (
        <div className="fixed inset-0 bg-nuit/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card max-w-lg w-full p-6 shadow-2xl border border-encre/10 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setNegotiationOpen(false)}
              className="absolute top-4 right-4 text-encre/40 hover:text-encre p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider mb-2">
              <span className="px-3 py-1 rounded-full bg-seve/10 border border-seve/25 text-seve flex items-center gap-1.5 font-bold text-[10px]">
                <Handshake className="w-3.5 h-3.5 text-seve" />
                <span>Négociation Directe Produit & Transport</span>
              </span>
            </div>

            <h3 className="text-lg font-bold text-nuit font-display">
              Discuter avec {product.store.storeName}
            </h3>
            <p className="text-xs text-encre/60 mt-1">
              Concluez un accord sur-mesure sur le prix de l’article et le mode d’expédition selon vos besoins.
            </p>

            {negotiationSuccess && (
              <div className="mt-4 p-3.5 rounded-card bg-seve/10 border border-seve/30 text-xs font-medium text-seve flex items-center gap-2">
                <Check className="w-4 h-4 text-seve shrink-0" />
                <span>{negotiationSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendNegotiation} className="mt-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-card bg-brume/70 border border-encre/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-nuit flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-seve" />
                    <span>Offre sur le Produit</span>
                  </span>
                  <span className="text-[11px] font-mono text-encre/60">
                    Prix catalogue : ${activeUnitPrice.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-encre/80 mb-1">Quantité (pièces)</label>
                    <input
                      type="number"
                      min={1}
                      value={targetQty}
                      onChange={(e) => setTargetQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-card border border-encre/20 font-display font-bold text-xs outline-none focus:border-seve bg-white text-encre"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-encre/80 mb-1">Prix unitaire proposé ($ USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-mono text-encre/40 font-bold">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min={1}
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 rounded-card border border-encre/20 font-display font-bold text-xs outline-none focus:border-seve bg-white text-encre"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-card bg-brume/70 border border-encre/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-nuit flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-seve" />
                    <span>Négociation du Transport / Expédition</span>
                  </span>
                  <span className="text-[10px] font-sans font-bold text-seve bg-seve/10 border border-seve/25 px-2 py-0.5 rounded-full">
                    Toute la RDC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-encre/80 mb-1">Ville de destination</label>
                    <select
                      value={targetCity}
                      onChange={(e) => setTargetCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-card border border-encre/20 font-medium text-xs outline-none bg-white focus:border-seve text-encre"
                    >
                      <option value="Kinshasa">Kinshasa</option>
                      <option value="Lubumbashi (Haut-Katanga)">Lubumbashi</option>
                      <option value="Goma (Nord-Kivu)">Goma</option>
                      <option value="Kisangani (Tshopo)">Kisangani</option>
                      <option value="Matadi (Kongo-Central)">Matadi</option>
                      <option value="Bukavu (Sud-Kivu)">Bukavu</option>
                      <option value="Kolwezi (Lualaba)">Kolwezi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-encre/80 mb-1">Frais transport ($ USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-mono text-encre/40 font-bold">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={targetDeliveryFee}
                        onChange={(e) => setTargetDeliveryFee(Math.max(0, Number(e.target.value)))}
                        className="w-full pl-7 pr-3 py-2 rounded-card border border-encre/20 font-display font-bold text-xs outline-none focus:border-seve bg-white text-encre"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-encre/80 mb-1">Mode d’acheminement souhaité</label>
                  <select
                    value={targetTransportMode}
                    onChange={(e) => setTargetTransportMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-card border border-encre/20 font-medium text-xs outline-none bg-white focus:border-seve text-encre"
                  >
                    <option value="Coursier Express Ville (Rapide)">Coursier Express Ville (Moto/Voiture)</option>
                    <option value="Retrait direct en boutique (Gratuit)">Retrait direct en boutique ($0.00)</option>
                    <option value="Bus / Agence Interurbaine (Fret provincial)">Bus / Agence Interurbaine (Fret inter-provinces)</option>
                    <option value="Transporteur Fret Fluvial / Cargo">Fret Aérien / Fluvial Fleuve Congo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-encre/80 mb-1">Message ou conditions au vendeur</label>
                <textarea
                  rows={2}
                  value={negotiationNote}
                  onChange={(e) => setNegotiationNote(e.target.value)}
                  placeholder="Ex : Besoin urgent pour ce vendredi à Gombe..."
                  className="w-full px-3.5 py-2 rounded-card border border-encre/20 text-xs outline-none focus:border-seve bg-white text-encre"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-encre/10">
                <button
                  type="button"
                  onClick={() => setNegotiationOpen(false)}
                  className="px-4 py-2 text-encre/60 hover:text-encre font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={negotiationSubmitting}
                  className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  <Handshake className="w-4 h-4 text-safran" />
                  <span>{negotiationSubmitting ? 'Transmission…' : 'Transmettre l’offre & Ouvrir le chat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
