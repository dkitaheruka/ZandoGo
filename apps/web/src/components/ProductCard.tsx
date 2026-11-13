import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Package, FileText, Sparkles, Heart, Scale, Star } from 'lucide-react';
import { useStore } from '../lib/store-context';
import type { Product } from '../lib/types';

const FALLBACK_IMAGE = '/src/assets/images/marketplace_parcel_default_1794567970796.jpg';

export function ProductCard({ product }: { product: Product }) {
  const { formatPrimaryPrice, formatSecondaryPrice, isWishlisted, toggleWishlist, compareProducts, toggleCompare } =
    useStore();
  const [imgSrc, setImgSrc] = useState(product.images[0]?.url || FALLBACK_IMAGE);

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

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-encre/10 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-seve/40">
      <Link to={`/products/${product.id}`} className="flex-1 flex flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-brume">
          <img
            src={imgSrc}
            alt={product.images[0]?.altText || product.title}
            referrerPolicy="no-referrer"
            onError={() => setImgSrc(FALLBACK_IMAGE)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Type Badge */}
          <div className="absolute top-2.5 left-2.5 bg-nuit/90 backdrop-blur-xs text-brume text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            {product.productType === 'DIGITAL' && (
              <>
                <FileText className="w-3 h-3 text-safran" />
                <span>PDF Digital</span>
              </>
            )}
            {product.productType === 'SERVICE' && (
              <>
                <Sparkles className="w-3 h-3 text-safran" />
                <span>Prestation</span>
              </>
            )}
            {product.productType === 'PHYSICAL' && (
              <>
                <Package className={`w-3 h-3 ${isLowStock ? 'text-wax' : 'text-seve'}`} />
                <span className={isLowStock ? 'text-wax font-bold' : ''}>{isLowStock ? 'Stock faible' : 'Matériel'}</span>
              </>
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

        <div className="p-4 flex flex-col justify-between flex-1">
          <div>
            <div className="flex items-center justify-between gap-1.5 text-xs text-encre/60">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate font-medium text-encre/80">{product.store.storeName}</span>
                <span title="Fournisseur vérifié">
                  <ShieldCheck className="w-3.5 h-3.5 text-seve shrink-0" />
                </span>
                {product.store.city && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-encre/45">{product.store.city}</span>
                  </>
                )}
              </div>
              {rating && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-display font-bold text-nuit shrink-0 tabular-nums">
                  <Star className="w-3 h-3 text-safran fill-safran" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>

            <h2 className="mt-1.5 line-clamp-2 min-h-10 font-bold text-encre text-xs leading-snug group-hover:text-seve transition-colors">
              {product.title}
            </h2>
          </div>

          <div className="mt-3 pt-3 border-t border-encre/10 flex items-baseline justify-between gap-2">
            <div>
              <p className="font-display text-base font-extrabold tabular-nums text-nuit">
                {formatPrimaryPrice(priceUsd)}
              </p>
              {bestTierPrice ? (
                <p className="text-[10px] font-display text-encre font-bold tabular-nums bg-safran/25 px-1.5 py-0.5 rounded-md mt-0.5 inline-block border border-safran/50">
                  Dès {formatPrimaryPrice(bestTierPrice)} si lot
                </p>
              ) : (
                <p className="text-[10px] font-mono text-encre/50 tabular-nums">
                  {formatSecondaryPrice(priceUsd)}
                </p>
              )}
            </div>

            <div className="text-right text-[11px] text-encre/60 font-sans shrink-0">
              {product.productType === 'PHYSICAL' && (
                <span className={isLowStock ? 'text-wax font-bold bg-wax/10 px-1.5 py-0.5 rounded border border-wax/25' : 'text-encre/70'}>
                  {product.stockQty !== undefined ? `${product.stockQty} en stock` : 'En rayon'}
                </span>
              )}
              {product.productType === 'DIGITAL' && <span className="text-seve font-medium">Téléchargement</span>}
              {product.productType === 'SERVICE' && <span className="text-seve font-medium">Prestation</span>}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
