import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
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
  Navigation,
  BadgeCheck,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Video,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import { PaymentOperatorStrip } from '../components/PaymentOperatorLogos';
import type { Product, ProductReview } from '../lib/types';

const CITY_SHIPPING_BASE: Record<string, { label: string; expressUsd: number; freightUsd: number }> = {
  Goma: { label: 'Goma (Grand Goma · Moto)', expressUsd: 3.5, freightUsd: 0 },
  Sake: { label: 'Sake (Territoire de Masisi)', expressUsd: 7, freightUsd: 5 },
  Bukavu: { label: 'Bukavu (Sud-Kivu · Bateau/Fret)', expressUsd: 10, freightUsd: 6 },
  Butembo: { label: 'Butembo (Nord-Kivu)', expressUsd: 12, freightUsd: 8 },
  Beni: { label: 'Beni (Nord-Kivu)', expressUsd: 13, freightUsd: 9 },
  Bunia: { label: 'Bunia (Ituri)', expressUsd: 15, freightUsd: 10 },
  Kisangani: { label: 'Kisangani (Tshopo · Cargo)', expressUsd: 16, freightUsd: 11 },
  Lubumbashi: { label: 'Lubumbashi / Kolwezi (Katanga)', expressUsd: 15, freightUsd: 10 },
  Kinshasa: { label: 'Kinshasa (Fret Aérien/Cargo)', expressUsd: 18, freightUsd: 12 },
  Matadi: { label: 'Matadi / Kongo-Central', expressUsd: 20, freightUsd: 14 },
  GisenyiKigali: { label: 'Gisenyi / Kigali (Rwanda · Environs)', expressUsd: 9, freightUsd: 6 },
  Bujumbura: { label: 'Bujumbura (Burundi · Environs)', expressUsd: 14, freightUsd: 9 },
  Kampala: { label: 'Kampala (Ouganda · Environs)', expressUsd: 18, freightUsd: 12 },
};

const GOMA_KM_PRESETS = [
  { label: 'Les Volcans ↔ Himbi', km: 4 },
  { label: 'Himbi ↔ Birere', km: 6 },
  { label: 'Centre-Ville ↔ Ndosho', km: 7 },
  { label: 'Aéroport Goma ↔ Lac Vert', km: 9 },
  { label: 'Goma ↔ Sake', km: 24 },
];

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
  const location = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [contactError, setContactError] = useState<string | null>(null);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  // Landed Cost Simulator
  const [simCity, setSimCity] = useState<string>('Goma');
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
  const [targetCity, setTargetCity] = useState('Goma (Nord-Kivu)');
  const [targetTransportMode, setTargetTransportMode] = useState('Coursier Express Ville (Rapide)');
  const [targetDeliveryFee, setTargetDeliveryFee] = useState<number>(3.5);
  const [negotiationNote, setNegotiationNote] = useState('');
  const [negotiationSubmitting, setNegotiationSubmitting] = useState(false);
  const [negotiationSuccess, setNegotiationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/products/${id}`).then(({ data }) => {
      setProduct(data);
      setActiveMediaIdx(0);
      setVariantId(data.variants[0]?.id ?? '');
      const base = Number(data.basePriceUsd);
      setTargetPrice(base);
      const defaultQty = data.pricingUnit === 'KM' ? Math.max(4, data.minOrderQty || 4) : 1;
      setQuantity(defaultQty);
      setTargetQty(defaultQty);
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

  const isPhysical = product.productType === 'PHYSICAL';
  const isDigital = product.productType === 'DIGITAL';
  const isService = product.productType === 'SERVICE';
  const isKm = product.pricingUnit === 'KM';

  // Dynamic Volume Tiered Pricing Calculation
  const baseUnitPrice = Number(selectedVariant?.priceOverride ?? product.basePriceUsd);
  let activeUnitPrice = baseUnitPrice;
  if (product.priceTiers && product.priceTiers.length > 0 && selectedVariant?.id === product.variants[0]?.id) {
    const matchedTier = product.priceTiers
      .slice()
      .reverse()
      .find((t) => quantity >= t.minQty && (t.maxQty === null || t.maxQty === undefined || quantity <= t.maxQty));
    if (matchedTier) {
      activeUnitPrice = matchedTier.unitPriceUsd;
    }
  }

  const stockAvailable = selectedVariant?.stockQty ?? product.stockQty ?? 0;
  const outOfStock = isPhysical && stockAvailable <= 0;
  const isLowStock = isPhysical && stockAvailable > 0 && stockAvailable <= (product.lowStockThreshold || 5);

  const cityCfg = CITY_SHIPPING_BASE[simCity] || CITY_SHIPPING_BASE.Goma;
  const simShippingUsd =
    isDigital || isKm
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

  // Color & Size extractions for variant picker
  const distinctColors = Array.from(
    new Map(
      product.variants
        .filter((v) => v.attributes?.color)
        .map((v) => [String(v.attributes?.color), String(v.attributes?.colorHex || '#172320')]),
    ).entries(),
  );
  const distinctSizes = Array.from(
    new Set(product.variants.map((v) => v.attributes?.size).filter((s): s is string => Boolean(s))),
  );
  const selectedColor = selectedVariant?.attributes?.color ? String(selectedVariant.attributes.color) : null;
  const selectedSize = selectedVariant?.attributes?.size ? String(selectedVariant.attributes.size) : null;

  function pickByColor(colorName: string) {
    if (!product) return;
    const exact = product.variants.find(
      (v) => v.attributes?.color === colorName && (!selectedSize || v.attributes?.size === selectedSize),
    );
    const fallback = product.variants.find((v) => v.attributes?.color === colorName);
    if (exact || fallback) setVariantId((exact || fallback)!.id);

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const tokens = normalize(colorName)
      .split(/[\s/&,-]+/)
      .filter((t) => t.length >= 3);
    if (tokens.length > 0 && product.images.length > 1) {
      const matchedIdx = product.images.findIndex((img) => {
        const alt = normalize(img.altText || '');
        return tokens.some((tok) => alt.includes(tok));
      });
      if (matchedIdx !== -1) {
        setActiveMediaIdx(matchedIdx);
      }
    }
  }

  function pickBySize(sizeVal: string) {
    if (!product) return;
    const exact = product.variants.find(
      (v) => v.attributes?.size === sizeVal && (!selectedColor || v.attributes?.color === selectedColor),
    );
    const fallback = product.variants.find((v) => v.attributes?.size === sizeVal);
    if (exact || fallback) setVariantId((exact || fallback)!.id);
  }

  async function handleAddToCart() {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setStatus('adding');
    try {
      await api.post('/cart/items', { productVariantId: variantId || product?.id, productId: product?.id, quantity });
      await refreshCart();
      setStatus('added');
    } catch {
      setStatus('error');
    }
  }

  async function handleSendNegotiation(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
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

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
        {/* Left: Product Media Gallery + Escrow + Landed Cost Simulator */}
        <div className="space-y-4">
          {(() => {
            const galleryImages = product.images || [];
            const hasVideo = Boolean(product.videoUrl);
            const totalSlides = galleryImages.length + (hasVideo ? 1 : 0);
            const safeSlideIdx = totalSlides > 0 ? activeMediaIdx % totalSlides : 0;
            const isVideoSlide = hasVideo && safeSlideIdx === galleryImages.length;
            const currentGalleryImage = !isVideoSlide ? galleryImages[safeSlideIdx] : null;

            return (
              <div className="space-y-2.5">
                <div className="rounded-card border border-encre/10 bg-white overflow-hidden shadow-xs relative group">
                  <div className="aspect-[4/3] bg-brume flex items-center justify-center overflow-hidden">
                    {isVideoSlide && product.videoUrl ? (
                      <video
                        src={product.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-contain bg-nuit"
                      />
                    ) : currentGalleryImage ? (
                      <img
                        src={currentGalleryImage.url}
                        alt={currentGalleryImage.altText || product.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-encre/20" />
                    )}
                  </div>

                  {totalSlides > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveMediaIdx((prev) => (prev - 1 + totalSlides) % totalSlides)}
                        aria-label="Média précédent"
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-nuit/80 hover:bg-nuit text-brume flex items-center justify-center shadow-md transition"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMediaIdx((prev) => (prev + 1) % totalSlides)}
                        aria-label="Média suivant"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-nuit/80 hover:bg-nuit text-brume flex items-center justify-center shadow-md transition"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

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

                  {totalSlides > 1 && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      {currentGalleryImage?.altText ? (
                        <span className="bg-nuit/80 backdrop-blur-xs text-brume text-[11px] font-medium px-2.5 py-1 rounded-full truncate max-w-[70%]">
                          {currentGalleryImage.altText}
                        </span>
                      ) : isVideoSlide ? (
                        <span className="bg-seve text-brume text-[11px] font-display font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-safran" />
                          <span>Vidéo présentation ({product.videoDurationSec || 10}s max)</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="bg-nuit/85 text-brume text-[11px] font-mono font-bold px-2.5 py-1 rounded-full tabular-nums">
                        {safeSlideIdx + 1} / {totalSlides}
                      </span>
                    </div>
                  )}
                </div>

                {totalSlides > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((img, idx) => {
                      const active = idx === safeSlideIdx;
                      return (
                        <button
                          key={img.id || idx}
                          type="button"
                          onClick={() => setActiveMediaIdx(idx)}
                          className={`relative h-16 w-20 shrink-0 rounded-card overflow-hidden border-2 transition ${
                            active ? 'border-seve ring-2 ring-seve/25' : 'border-encre/15 opacity-75 hover:opacity-100'
                          }`}
                          title={img.altText || `Photo ${idx + 1}`}
                        >
                          <img
                            src={img.url}
                            alt={img.altText || `${product.title} ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaIdx(galleryImages.length)}
                        className={`relative h-16 w-24 shrink-0 rounded-card overflow-hidden border-2 bg-nuit text-brume flex flex-col items-center justify-center gap-1 transition ${
                          isVideoSlide ? 'border-safran ring-2 ring-safran/35' : 'border-encre/15 opacity-85 hover:opacity-100'
                        }`}
                        title="Regarder la vidéo de présentation"
                      >
                        <Video className="w-4 h-4 text-safran" />
                        <span className="text-[10px] font-display font-bold">
                          Vidéo {product.videoDurationSec ? `(${product.videoDurationSec}s)` : ''}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
            <div className="pt-2 border-t border-white/10">
              <PaymentOperatorStrip compact dark />
            </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-nuit">{product.store.storeName}</span>
              {product.store.isCertified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-seve/10 text-seve border border-seve/30 font-display font-bold text-[10px]">
                  <BadgeCheck className="w-3.5 h-3.5 text-seve" />
                  <span>Vendeur Certifié ZandoGo</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-encre/5 text-encre/65 border border-encre/15 font-medium text-[10px]">
                  <span>Boutique standard</span>
                </span>
              )}
              {product.isSponsored && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-safran text-nuit font-display font-bold text-[10px]">
                  <Megaphone className="w-3 h-3" />
                  <span>Annonce Sponsorisée</span>
                </span>
              )}
              <span className="text-encre/50">· {product.store.city || 'Goma (Nord-Kivu)'}</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
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
                  {isKm ? 'Tarifs dégressifs selon distance (en km)' : 'Tarifs selon quantité (Vente au détail & gros)'}
                </span>
                <span className="text-[11px] font-display text-nuit font-semibold bg-safran/20 px-2.5 py-0.5 rounded-md border border-safran/40">
                  {isKm ? 'Évaluation au km' : 'Prix dynamique appliqué'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {product.priceTiers.map((tier, idx) => {
                  const isActive =
                    quantity >= tier.minQty &&
                    (tier.maxQty === null || tier.maxQty === undefined || quantity <= tier.maxQty);
                  const unitLbl = isKm ? 'km' : 'pcs';
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
                        {tier.maxQty ? `${tier.minQty} - ${tier.maxQty} ${unitLbl}` : `${tier.minQty}+ ${unitLbl}`}
                      </p>
                      <p className="text-base font-display font-bold text-nuit mt-1 tabular-nums">
                        {formatPrimaryPrice(tier.unitPriceUsd)}{isKm ? '/km' : ''}
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
                {formatPrimaryPrice(activeUnitPrice)}{isKm ? ' / km' : ''}
              </span>
              <span className="text-xs font-mono text-encre/60 tabular-nums">
                ({formatSecondaryPrice(activeUnitPrice)})
              </span>
            </div>
          )}

          {/* Offering Meta Modules */}
          {isDigital && (
            <div className="p-4 rounded-card bg-safran/15 border border-safran/40 text-xs text-encre">
              <p className="font-display font-semibold text-nuit uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-seve" />
                <span>Téléchargement Numérique Direct · Aucune livraison requise ($0)</span>
              </p>
              <p className="text-encre/80 mt-1 leading-relaxed">
                Livre / Document PDF ({product.digitalFileSize || '18 Mo'}). Juste après validation de votre paiement (Airtel Money, M-Pesa Vodacom, Orange Money, MTN MoMo ou Carte), votre lien de téléchargement direct est activé et transmis par SMS Africa’s Talking.
              </p>
            </div>
          )}

          {isService && (
            <div className="p-4 rounded-card bg-safran/15 border border-safran/40 text-xs text-encre">
              <p className="font-display font-semibold text-nuit uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                {isKm ? <Navigation className="w-4 h-4 text-seve" /> : <Sparkles className="w-4 h-4 text-seve" />}
                <span>{isKm ? 'Prestation Transport Évaluée au Kilomètre' : 'Prestation & Mise en Service'}</span>
              </p>
              <p className="text-encre/80 mt-1 leading-relaxed">
                {product.serviceDuration || 'Intervention sous 24h'}. {product.fulfillmentDetails || 'Prise de contact téléphonique du technicien dans les 2 heures.'}
              </p>
            </div>
          )}

          {product.store.isTransportAgency &&
            product.store.transportDestinations &&
            product.store.transportDestinations.length > 0 && (
              <div className="p-4 rounded-card bg-white border border-seve/30 text-xs space-y-2.5 shadow-xs">
                <p className="font-display font-bold text-nuit uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-seve" />
                  <span>Lignes & Destinations desservies par cette Agence</span>
                </p>
                <div className="divide-y divide-encre/10">
                  {product.store.transportDestinations.map((dest) => (
                    <div key={dest.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-display font-bold text-nuit">
                          {dest.originCity} &rarr; {dest.destinationCity}
                        </span>
                        <span className="block text-[10px] text-encre/60 font-mono">
                          {dest.vehicleMode} · Délai : {dest.estimatedDelay}
                        </span>
                      </div>
                      <span className="font-display font-bold text-seve tabular-nums">
                        {formatPrimaryPrice(dest.basePriceUsd)}
                        {dest.pricePerKmUsd ? ` (+${formatPrimaryPrice(dest.pricePerKmUsd)}/km)` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {isPhysical && (
            <div className="p-3.5 rounded-card bg-white border border-encre/10 text-xs flex items-center justify-between">
              <span className="text-encre/70 font-medium">Stock entrepôt ({selectedVariant?.sku || 'STD'}) :</span>
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

          {(product.description || product.videoUrl) && (
            <div className="space-y-3 pt-1">
              {product.description && (
                <p className="text-xs text-encre/75 leading-relaxed">
                  {product.description}
                </p>
              )}

              {product.videoUrl && (
                <div className="rounded-card border border-encre/10 bg-white p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display font-bold text-nuit flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-seve" />
                      <span>Aperçu vidéo du vendeur</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-seve/10 text-seve border border-seve/25">
                      {product.videoDurationSec ? `${product.videoDurationSec}s · Max 10s` : 'Format court ≤ 10s'}
                    </span>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-nuit border border-encre/10">
                    <video
                      src={product.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-64 object-contain bg-nuit"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Colors + Sizes + Variants Selector */}
          {(distinctColors.length > 0 || distinctSizes.length > 0 || product.variants.length > 1) && (
            <div className="p-4 rounded-card bg-white border border-encre/10 space-y-4">
              {distinctColors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-display font-semibold uppercase tracking-wider text-encre/60">Couleur</span>
                    <span className="font-semibold text-nuit">{selectedColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {distinctColors.map(([colorName, hex]) => {
                      const active = selectedColor === colorName;
                      return (
                        <button
                          key={colorName}
                          type="button"
                          onClick={() => pickByColor(colorName)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-card text-xs font-medium border transition ${
                            active
                              ? 'border-nuit bg-nuit text-brume font-bold shadow-xs'
                              : 'border-encre/15 bg-brume/40 text-encre hover:border-seve'
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/40 shadow-2xs shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <span>{colorName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {distinctSizes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-display font-semibold uppercase tracking-wider text-encre/60">
                      Taille / Format
                    </span>
                    <span className="font-semibold text-nuit">{selectedSize}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {distinctSizes.map((sizeVal) => {
                      const active = selectedSize === sizeVal;
                      return (
                        <button
                          key={sizeVal}
                          type="button"
                          onClick={() => pickBySize(sizeVal)}
                          className={`px-3.5 py-1.5 rounded-card text-xs font-bold border transition ${
                            active
                              ? 'border-seve bg-seve text-brume shadow-xs'
                              : 'border-encre/15 bg-white text-encre hover:border-seve'
                          }`}
                        >
                          {sizeVal}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {distinctColors.length === 0 && distinctSizes.length === 0 && product.variants.length > 1 && (
                <div>
                  <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/60 mb-2">
                    Option / Formule
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
            </div>
          )}

          {/* Distance Calculator (when pricingUnit === 'KM') OR Standard Quantity Selector */}
          {isKm ? (
            <div className="p-4 rounded-card bg-white border border-seve/30 space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="km-input" className="font-display font-bold text-nuit flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-seve" />
                  <span>Distance estimée du trajet (en km) :</span>
                </label>
                <span className="font-mono text-seve font-bold">
                  {formatPrimaryPrice(activeUnitPrice)} / km
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {GOMA_KM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setQuantity(preset.km)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                      quantity === preset.km
                        ? 'bg-nuit text-safran border-nuit font-bold'
                        : 'bg-brume/60 text-encre/80 border-encre/15 hover:border-seve'
                    }`}
                  >
                    {preset.label} ({preset.km} km)
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    id="km-input"
                    type="range"
                    min={1}
                    max={45}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full accent-seve"
                  />
                  <span className="font-display font-extrabold text-sm text-nuit w-16 text-right tabular-nums">
                    {quantity} km
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-encre/50 block">Coût course ({quantity} km)</span>
                  <span className="font-display text-base font-extrabold text-nuit tabular-nums">
                    {formatPrimaryPrice(activeUnitPrice * quantity)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            isPhysical && (
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
            )
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
      <section id="reviews-section" className="mt-8 pt-6 border-t border-encre/10 grid lg:grid-cols-[1.2fr_0.9fr] gap-6">
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
                      <option value="Goma (Nord-Kivu)">Goma (Nord-Kivu)</option>
                      <option value="Sake (Masisi)">Sake (Masisi)</option>
                      <option value="Bukavu (Sud-Kivu)">Bukavu (Sud-Kivu)</option>
                      <option value="Butembo (Nord-Kivu)">Butembo (Nord-Kivu)</option>
                      <option value="Beni (Nord-Kivu)">Beni (Nord-Kivu)</option>
                      <option value="Bunia (Ituri)">Bunia (Ituri)</option>
                      <option value="Kisangani (Tshopo)">Kisangani (Tshopo)</option>
                      <option value="Lubumbashi / Kolwezi (Katanga)">Lubumbashi / Kolwezi (Katanga)</option>
                      <option value="Kinshasa">Kinshasa</option>
                      <option value="Matadi (Kongo-Central)">Matadi (Kongo-Central)</option>
                      <option value="Kananga / Mbuji-Mayi (Kasaï)">Kananga / Mbuji-Mayi (Kasaï)</option>
                      <option value="Gisenyi / Kigali (Rwanda)">Gisenyi / Kigali (Rwanda)</option>
                      <option value="Bujumbura (Burundi)">Bujumbura (Burundi)</option>
                      <option value="Kampala (Ouganda)">Kampala (Ouganda)</option>
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
                    <option value="Coursier Express Goma (Moto/Voiture)">Coursier Express Goma (Moto/Voiture)</option>
                    <option value="Retrait direct en boutique (Gratuit)">Retrait direct en boutique ($0.00)</option>
                    <option value="Bus / Agence Interurbaine (Nord & Sud-Kivu)">Bus / Agence Interurbaine (Nord & Sud-Kivu)</option>
                    <option value="Bateau Lac Kivu / Fret National">Bateau Lac Kivu (Bukavu) / Fret Cargo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-encre/80 mb-1">Message ou conditions au vendeur</label>
                <textarea
                  rows={2}
                  value={negotiationNote}
                  onChange={(e) => setNegotiationNote(e.target.value)}
                  placeholder="Ex : Besoin urgent pour ce vendredi à Himbi / Les Volcans..."
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
