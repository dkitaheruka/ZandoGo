import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  Heart,
  Scale,
  Star,
  BadgeCheck,
  Megaphone,
  ShoppingCart,
  Check,
  Truck,
  ChevronLeft,
  ChevronRight,
  Video,
} from 'lucide-react';
import { useStore } from '../lib/store-context';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import type { Product } from '../lib/types';

const FALLBACK_IMAGE = '/src/assets/images/marketplace_parcel_default_1794567970796.jpg';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    formatPrimaryPrice,
    formatSecondaryPrice,
    isWishlisted,
    toggleWishlist,
    compareProducts,
    toggleCompare,
    refreshCart,
  } = useStore();
  const images =
    product.images && product.images.length > 0
      ? product.images
      : [{ id: 'fallback', url: FALLBACK_IMAGE, altText: product.title }];
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedIdxMap, setFailedIdxMap] = useState<Record<number, boolean>>({});
  const [cartBusy, setCartBusy] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    setActiveIdx(0);
    setFailedIdxMap({});
  }, [product.id]);

  const safeIdx = activeIdx % images.length;
  const currentImg = images[safeIdx];
  const imgSrc = failedIdxMap[safeIdx] ? FALLBACK_IMAGE : currentImg?.url || FALLBACK_IMAGE;

  function goPrevImage(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev - 1 + images.length) % images.length);
  }

  function goNextImage(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev + 1) % images.length);
  }

  const priceUsd = Number(product.basePriceUsd);
  const isLowStock =
    product.productType === 'PHYSICAL' &&
    product.stockQty !== undefined &&
    product.stockQty <= (product.lowStockThreshold || 5);

  const bestTierPrice =
    product.priceTiers && product.priceTiers.length > 1
      ? product.priceTiers[product.priceTiers.length - 1].unitPriceUsd
      : null;

  const wishlisted = isWishlisted(product.id);
  const compared = compareProducts.some((p) => p.id === product.id);
  const rating = product.rating ?? product.store.rating;

  const isKm = product.pricingUnit === 'KM';
  const unitSuffix = isKm ? ' / km' : '';

  const colorVariants = Array.from(
    new Map(
      (product.variants || [])
        .filter((v) => v.attributes?.color)
        .map((v) => [String(v.attributes?.color), String(v.attributes?.colorHex || '#172320')]),
    ).entries(),
  );

  const audienceLabel =
    product.audience === 'WOMEN'
      ? 'Femme'
      : product.audience === 'MEN'
      ? 'Homme'
      : product.audience === 'PRO'
      ? 'Pro / Service'
      : null;

  const isOutOfStock = product.productType === 'PHYSICAL' && product.stockQty === 0;

  async function handleQuickAddToCart(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || cartBusy) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const productVariantId = product.variants?.[0]?.id;
    if (!productVariantId) {
      setCartError('Aucune variante disponible pour cet article.');
      return;
    }

    setCartError(null);
    setCartBusy(true);
    try {
      await api.post('/cart/items', {
        productVariantId,
        quantity: product.minOrderQty || 1,
      });
      await refreshCart();
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setCartError(
        Array.isArray(message)
          ? message.join(' ')
          : (message ?? "Impossible d'ajouter cet article au panier. Réessayez."),
      );
    } finally {
      setCartBusy(false);
    }
  }

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-card border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-seve/40 ${
        product.isSponsored ? 'border-safran/60 ring-1 ring-safran/20' : 'border-encre/10'
      }`}
    >
      <Link to={`/products/${product.id}`} className="flex-1 flex flex-col">
        <div className="relative aspect-[5/4] overflow-hidden bg-brume">
          <img
            src={imgSrc}
            alt={currentImg?.altText || product.title}
            referrerPolicy="no-referrer"
            onError={() => setFailedIdxMap((prev) => ({ ...prev, [safeIdx]: true }))}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrevImage}
                aria-label="Photo précédente"
                title="Photo précédente"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-nuit/80 hover:bg-nuit text-brume flex items-center justify-center shadow-sm transition opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={goNextImage}
                aria-label="Photo suivante"
                title="Photo suivante"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-nuit/80 hover:bg-nuit text-brume flex items-center justify-center shadow-sm transition opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1 bg-nuit/70 backdrop-blur-xs px-2 py-1 rounded-full pointer-events-auto">
                  {images.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      type="button"
                      aria-label={`Afficher photo ${idx + 1}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveIdx(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === safeIdx ? 'w-4 bg-safran' : 'w-1.5 bg-white/60 hover:bg-white'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {product.videoUrl && (
                    <span className="bg-seve/95 text-brume text-[10px] font-display font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs">
                      <Video className="w-2.5 h-2.5 text-safran" />
                      <span>{product.videoDurationSec ? `${product.videoDurationSec}s` : 'Vidéo'}</span>
                    </span>
                  )}
                  <span className="bg-nuit/80 text-brume text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs tabular-nums">
                    {safeIdx + 1}/{images.length}
                  </span>
                </div>
              </div>
            </>
          )}

          {images.length <= 1 && product.videoUrl && (
            <span className="absolute bottom-2 right-2.5 bg-seve/95 text-brume text-[10px] font-display font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs">
              <Video className="w-2.5 h-2.5 text-safran" />
              <span>Vidéo {product.videoDurationSec ? `${product.videoDurationSec}s` : ''}</span>
            </span>
          )}

          {/* Type, Sponsored & Audience Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[75%]">
            {product.isSponsored && (
              <span className="bg-safran text-nuit text-[9px] font-display font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs uppercase tracking-wide">
                <Megaphone className="w-2.5 h-2.5 text-nuit" />
                <span>Sponsorisé</span>
              </span>
            )}
            <div className="bg-nuit/90 backdrop-blur-xs text-brume text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              {product.productType === 'DIGITAL' && (
                <>
                  <FileText className="w-2.5 h-2.5 text-safran" />
                  <span>PDF</span>
                </>
              )}
              {product.productType === 'SERVICE' && (
                <>
                  <Sparkles className="w-2.5 h-2.5 text-safran" />
                  <span>{isKm ? 'Tarif / km' : 'Service'}</span>
                </>
              )}
              {product.productType === 'PHYSICAL' && (
                <>
                  <Package className={`w-2.5 h-2.5 ${isLowStock ? 'text-wax' : 'text-seve'}`} />
                  <span className={isLowStock ? 'text-wax font-bold' : ''}>{isLowStock ? 'Stock bas' : 'Produit'}</span>
                </>
              )}
            </div>
            {audienceLabel && product.productType === 'PHYSICAL' && (
              <span className="bg-white/95 text-nuit text-[9px] font-display font-bold px-1.5 py-0.5 rounded-full shadow-xs border border-encre/10">
                {audienceLabel}
              </span>
            )}
          </div>

          {/* Wishlist & Compare Quick Actions */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCompare(product);
              }}
              className={`h-7 w-7 rounded-full backdrop-blur-xs flex items-center justify-center transition shadow-xs ${
                compared
                  ? 'bg-safran text-nuit'
                  : 'bg-white/90 text-encre/60 hover:text-nuit opacity-90 group-hover:opacity-100'
              }`}
              title={compared ? 'Retirer du comparateur' : 'Comparer ce produit'}
              aria-label="Comparer"
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              className={`h-7 w-7 rounded-full backdrop-blur-xs flex items-center justify-center transition shadow-xs ${
                wishlisted
                  ? 'bg-wax text-white'
                  : 'bg-white/90 text-encre/60 hover:text-wax opacity-90 group-hover:opacity-100'
              }`}
              title={wishlisted ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-label="Favoris"
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-2 flex flex-col flex-1 gap-1.5">
          <div>
            <div className="flex items-center justify-between gap-1 text-[10px] text-encre/60">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate font-medium text-encre/80">{product.store.storeName}</span>
                {product.store.isCertified && (
                  <span
                    title="Vendeur Certifié ZandoGo"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-seve/10 text-seve border border-seve/25 text-[8.5px] font-display font-bold shrink-0"
                  >
                    <BadgeCheck className="w-2.5 h-2.5 text-seve" />
                    <span>Certifié</span>
                  </span>
                )}
                {product.store.city && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-encre/45">{product.store.city}</span>
                  </>
                )}
              </div>
              {rating && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-display font-bold text-nuit shrink-0 tabular-nums">
                  <Star className="w-2.5 h-2.5 text-safran fill-safran" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>

            <h2 className="mt-0.5 line-clamp-2 font-bold text-encre text-xs leading-snug group-hover:text-seve transition-colors">
              {product.title}
            </h2>

            {product.store.isTransportAgency && product.store.transportDestinations && product.store.transportDestinations.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-seve bg-seve/10 border border-seve/25 px-1.5 py-0.5 rounded-md truncate">
                <Truck className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">
                  {product.store.transportDestinations.map((d) => d.destinationCity).slice(0, 2).join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="pt-1.5 border-t border-encre/10 space-y-0.5">
            {/* Colors + Price side by side */}
            <div className="flex items-center justify-between gap-2">
              {colorVariants.length > 0 ? (
                <div className="flex items-center gap-1 min-w-0">
                  {colorVariants.slice(0, 4).map(([label, hex]) => (
                    <span
                      key={label}
                      title={label}
                      className="h-2.5 w-2.5 rounded-full border border-encre/20 shadow-2xs shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <span className="text-[10px] text-encre/55 font-medium truncate">
                    {product.variants.length > 1 ? `${product.variants.length} opt.` : colorVariants[0][0]}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-mono text-encre/50 tabular-nums truncate">
                  {formatSecondaryPrice(priceUsd)}{unitSuffix}
                </span>
              )}

              <p className="font-display text-sm font-extrabold tabular-nums text-nuit shrink-0">
                {formatPrimaryPrice(priceUsd)}
                {unitSuffix && <span className="text-[10px] font-semibold text-seve">{unitSuffix}</span>}
              </p>
            </div>

            {/* Bulk tier or secondary currency + stock */}
            <div className="flex items-center justify-between gap-1.5 text-[10px] text-encre/60">
              {bestTierPrice ? (
                <span className="text-[9px] font-display text-nuit font-bold tabular-nums bg-safran/20 px-1.5 py-0.5 rounded border border-safran/40 truncate">
                  Dès {formatPrimaryPrice(bestTierPrice)}{unitSuffix} {isKm ? 'long trajet' : 'si lot'}
                </span>
              ) : colorVariants.length > 0 ? (
                <span className="font-mono text-encre/50 tabular-nums truncate">
                  {formatSecondaryPrice(priceUsd)}{unitSuffix}
                </span>
              ) : (
                <span />
              )}

              <div className="text-right font-sans shrink-0">
                {product.productType === 'PHYSICAL' && (
                  <span className={isLowStock ? 'text-wax font-bold bg-wax/10 px-1 py-0.5 rounded border border-wax/25' : 'text-encre/70'}>
                    {product.stockQty !== undefined ? `${product.stockQty} stock` : 'Dispo'}
                  </span>
                )}
                {product.productType === 'DIGITAL' && <span className="text-seve font-medium">0$ livr.</span>}
                {product.productType === 'SERVICE' && (
                  <span className="text-seve font-medium">{isKm ? 'Au km' : 'Service'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-2 pt-0">
        <button
          type="button"
          disabled={isOutOfStock || cartBusy}
          aria-busy={cartBusy}
          onClick={handleQuickAddToCart}
          className={`mt-auto w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-card text-[11px] font-display font-bold transition shadow-2xs ${
            isOutOfStock
              ? 'bg-encre/10 text-encre/40 cursor-not-allowed'
              : addedFeedback
              ? 'bg-seve text-brume'
              : 'bg-nuit hover:bg-seve text-brume'
          }`}
        >
          {addedFeedback ? (
            <>
              <Check className="w-3 h-3 text-safran" />
              <span>Ajouté ✓</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-3 h-3 text-safran" />
              <span>{cartBusy ? 'Ajout…' : isOutOfStock ? 'Épuisé' : 'Ajouter au panier'}</span>
            </>
          )}
        </button>
        {cartError && (
          <p role="alert" className="mt-1 text-xs leading-4 text-wax">
            {cartError}
          </p>
        )}
      </div>
    </article>
  );
}
