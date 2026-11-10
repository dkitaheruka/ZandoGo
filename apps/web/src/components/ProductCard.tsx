import { Link } from 'react-router-dom';
import type { Product } from '../lib/types';

export function ProductCard({ product }: { product: Product }) {
  const price = Number(product.basePriceUsd);
  const image = product.images[0];
  return (
    <article className="group overflow-hidden rounded-card border border-encre/10 bg-white transition-shadow hover:shadow-lg">
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-brume">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-encre/40">Image à venir</div>
          )}
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-encre/50">{product.store.storeName}</p>
          <h2 className="mt-1 line-clamp-2 min-h-12 font-medium text-encre">{product.title}</h2>
          <p className="mt-3 font-display text-lg font-semibold">
            {price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </p>
        </div>
      </Link>
    </article>
  );
}
