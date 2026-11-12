import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, FileText, Sparkles, Layers } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { api } from '../lib/api';
import type { Product } from '../lib/types';

export function ProductListPage() {
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PHYSICAL' | 'DIGITAL' | 'SERVICE'>('ALL');
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlQuery !== query) {
      setSearch(urlQuery);
      setQuery(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Product[]>('/products', { params: query ? { search: query } : {} })
      .then(({ data }) => {
        if (active) setProducts(data || []);
      })
      .catch(() => {
        if (active) setError('Impossible de charger les produits. Vérifiez votre connexion puis réessayez.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, retryKey]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
  }

  const filteredProducts = products.filter((p) => {
    if (typeFilter === 'ALL') return true;
    return p.productType === typeFilter;
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 uppercase tracking-wider">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center gap-1.5 font-bold text-[10px]">
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span>Place de Marché Universelle ZandoGo</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
            Offres & Catalogues RDC
          </h1>
          <p className="mt-2 text-xs text-slate-500 max-w-xl">
            Fournisseurs et commerçants vérifiés dans toute la République (Kinshasa, Lubumbashi, Goma, Matadi, Kisangani). Vente au détail dès 1 pièce et en gros avec transport suivi.
          </p>
        </div>

        <form onSubmit={submit} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              id="product-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Wax, livre PDF, fibre pro, smartphone..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#0B0F19] px-5 py-2.5 text-xs font-bold text-cyan-300 hover:text-white hover:bg-slate-900 transition shadow-xs shrink-0 border border-cyan-500/30"
          >
            Rechercher
          </button>
        </form>
      </div>

      {/* Segmented Filter Control */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium ${
              typeFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Toutes les offres ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('PHYSICAL')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium ${
              typeFilter === 'PHYSICAL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Biens physiques ({products.filter((p) => p.productType === 'PHYSICAL').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('DIGITAL')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium ${
              typeFilter === 'DIGITAL'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Numériques & PDF ({products.filter((p) => p.productType === 'DIGITAL').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('SERVICE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium ${
              typeFilter === 'SERVICE'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Services & Télécoms ({products.filter((p) => p.productType === 'SERVICE').length})</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 font-mono tabular-nums">
          {filteredProducts.length} résultat{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline font-semibold" onClick={() => setRetryKey((value) => value + 1)}>
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="h-72 rounded-2xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        !error && (
          <div className="py-20 text-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 mt-8">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Aucune offre trouvée</h3>
            <p className="mt-1 text-xs text-slate-500">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
            <button
              onClick={() => {
                setSearch('');
                setQuery('');
                setTypeFilter('ALL');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800"
            >
              Afficher tout le catalogue
            </button>
          </div>
        )
      )}
    </section>
  );
}
