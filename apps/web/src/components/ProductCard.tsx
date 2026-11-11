import { Link } from 'react-router-dom';
import { ShieldCheck, Package, FileText, Sparkles } from 'lucide-react';
import type { Product } from '../lib/types';

export function ProductCard({ product }: { product: Product }) {
  const priceUsd = Number(product.basePriceUsd);
  const priceCdf = product.basePriceCdf ? Number(product.basePriceCdf) : Math.round(priceUsd * 2850);
  const image = product.images[0];
  const isLowStock =
    product.productType === 'PHYSICAL' &&
    product.stockQty !== undefined &&
    product.stockQty <= (product.lowStockThreshold || 5);

  const bestTierPrice =
    product.priceTiers && product.priceTiers.length > 1
      ? product.priceTiers[product.priceTiers.length - 1].unitPriceUsd
      : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <Link to={`/products/${product.id}`} className="block flex-1">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-100 text-xs text-slate-400">
              Aperçu indisponible
            </div>
          )}

          {/* Type Badge */}
          <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            {product.productType === 'DIGITAL' && (
              <>
                <FileText className="w-3 h-3 text-indigo-400" />
                <span>PDF Digital</span>
              </>
            )}
            {product.productType === 'SERVICE' && (
              <>
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Prestation</span>
              </>
            )}
            {product.productType === 'PHYSICAL' && (
              <>
                <Package className="w-3 h-3 text-emerald-400" />
                <span>{isLowStock ? 'Stock faible' : 'Matériel'}</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between flex-1">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="truncate font-medium text-slate-700">{product.store.storeName}</span>
              <span title="Fournisseur vérifié">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              </span>
              {product.store.city && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate text-slate-400">{product.store.city}</span>
                </>
              )}
            </div>

            <h2 className="mt-1.5 line-clamp-2 min-h-10 font-semibold text-slate-900 text-xs leading-snug group-hover:text-amber-600 transition-colors">
              {product.title}
            </h2>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <p className="font-mono text-base font-bold tabular-nums text-slate-900">
                ${priceUsd.toFixed(2)}
              </p>
              {bestTierPrice ? (
                <p className="text-[10px] font-mono text-amber-700 font-semibold tabular-nums">
                  Dès ${bestTierPrice.toFixed(2)} en gros
                </p>
              ) : (
                <p className="text-[10px] font-mono text-slate-400 tabular-nums">
                  ≈ {priceCdf.toLocaleString('fr-FR')} CDF
                </p>
              )}
            </div>

            <div className="text-right text-[11px] text-slate-500 font-mono">
              {product.productType === 'PHYSICAL' && (
                <span className={isLowStock ? 'text-amber-700 font-bold' : ''}>
                  {product.stockQty !== undefined ? `${product.stockQty} en stock` : 'En rayon'}
                </span>
              )}
              {product.productType === 'DIGITAL' && <span>Téléchargement</span>}
              {product.productType === 'SERVICE' && <span>Sur rendez-vous</span>}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
