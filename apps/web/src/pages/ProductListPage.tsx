import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, FileText, Sparkles, Layers, Heart, Scale, MapPin } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import type { Product } from '../lib/types';

type TypeFilter = 'ALL' | 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
type SortKey = 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING';

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlType = (searchParams.get('type')?.toUpperCase() || 'ALL') as TypeFilter;
  const urlFavorites = searchParams.get('favorites') === '1';

  const { wishlistIds, compareProducts, setCompareOpen } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    ['ALL', 'PHYSICAL', 'DIGITAL', 'SERVICE'].includes(urlType) ? urlType : 'ALL',
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('RELEVANCE');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(urlFavorites);
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(urlQuery);
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (['ALL', 'PHYSICAL', 'DIGITAL', 'SERVICE'].includes(urlType)) {
      setTypeFilter(urlType);
    }
  }, [urlType]);

  useEffect(() => {
    setFavoritesOnly(urlFavorites);
  }, [urlFavorites]);

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>('/categories')
      .then(({ data }) => setCategories(data || []))
      .catch(() => {});
  }, []);

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
    const trimmed = search.trim();
    setQuery(trimmed);
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    setSearchParams(next);
  }

  function handleSelectType(nextType: TypeFilter) {
    setTypeFilter(nextType);
    const next = new URLSearchParams(searchParams);
    if (nextType === 'ALL') next.delete('type');
    else next.set('type', nextType);
    setSearchParams(next);
  }

  const cities = Array.from(
    new Set(products.map((p) => p.store.city).filter((c): c is string => Boolean(c))),
  );

  const filteredProducts = products
    .filter((p) => {
      if (typeFilter !== 'ALL' && p.productType !== typeFilter) return false;
      if (selectedCategory !== 'ALL' && p.category?.id !== selectedCategory) return false;
      if (selectedCity !== 'ALL' && p.store.city !== selectedCity) return false;
      if (favoritesOnly && !wishlistIds.includes(p.id)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'PRICE_ASC') return Number(a.basePriceUsd) - Number(b.basePriceUsd);
      if (sortBy === 'PRICE_DESC') return Number(b.basePriceUsd) - Number(a.basePriceUsd);
      if (sortBy === 'RATING') return (b.rating ?? b.store.rating ?? 0) - (a.rating ?? a.store.rating ?? 0);
      return 0;
    });

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-encre/10 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider">
            <span className="px-3 py-0.5 rounded-full bg-seve/10 border border-seve/25 text-seve flex items-center gap-1.5 font-bold text-[10px]">
              <Layers className="w-3.5 h-3.5 text-seve" />
              <span>Place de Marché Universelle ZandoGo</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-extrabold text-nuit tracking-tight">
            Offres & Catalogues RDC
          </h1>
          <p className="mt-2 text-xs text-encre/70 max-w-xl">
            Fournisseurs et commerçants vérifiés dans toute la République (Kinshasa, Lubumbashi, Goma, Matadi, Kisangani). Vente au détail dès 1 pièce et en gros avec transport suivi.
          </p>
        </div>

        <form onSubmit={submit} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-encre/40" />
            <input
              id="product-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Wax, café du Kivu, fibre pro, smartphone..."
              className="w-full rounded-card border border-encre/20 bg-white pl-10 pr-4 py-2.5 text-xs text-encre outline-none focus:border-seve focus:ring-1 focus:ring-seve transition shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-card bg-seve px-5 py-2.5 text-xs font-display font-bold text-brume hover:bg-seve/90 transition shadow-xs shrink-0"
          >
            Rechercher
          </button>
        </form>
      </div>

      {/* Type Tabs + Secondary Filters */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-encre/5 rounded-card overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => handleSelectType('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition font-medium whitespace-nowrap ${
                typeFilter === 'ALL' ? 'bg-white text-nuit shadow-xs font-bold' : 'text-encre/70 hover:text-encre'
              }`}
            >
              Toutes ({products.length})
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('PHYSICAL')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium whitespace-nowrap ${
                typeFilter === 'PHYSICAL' ? 'bg-white text-nuit shadow-xs font-bold' : 'text-encre/70 hover:text-encre'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-seve" />
              <span>Physiques ({products.filter((p) => p.productType === 'PHYSICAL').length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('DIGITAL')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium whitespace-nowrap ${
                typeFilter === 'DIGITAL' ? 'bg-white text-nuit shadow-xs font-bold' : 'text-encre/70 hover:text-encre'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-encre/70" />
              <span>PDF & Digitaux ({products.filter((p) => p.productType === 'DIGITAL').length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('SERVICE')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium whitespace-nowrap ${
                typeFilter === 'SERVICE' ? 'bg-white text-nuit shadow-xs font-bold' : 'text-encre/70 hover:text-encre'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-safran" />
              <span>Services ({products.filter((p) => p.productType === 'SERVICE').length})</span>
            </button>
          </div>

          {/* City, Sort, Favorites */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border transition font-medium ${
                favoritesOnly
                  ? 'bg-wax text-white border-wax'
                  : 'bg-white text-encre/80 border-encre/15 hover:border-wax/50'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-white' : 'text-wax'}`} />
              <span>Favoris ({wishlistIds.length})</span>
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-card border border-encre/15 bg-white px-3 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-seve" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-transparent outline-none text-xs font-medium text-encre"
                aria-label="Filtrer par ville"
              >
                <option value="ALL">Toutes les villes</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-card border border-encre/15 bg-white px-3 py-1.5 text-xs font-medium text-encre outline-none"
              aria-label="Trier par"
            >
              <option value="RELEVANCE">Tri : Pertinence</option>
              <option value="PRICE_ASC">Prix croissant</option>
              <option value="PRICE_DESC">Prix décroissant</option>
              <option value="RATING">Mieux notés</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-full border whitespace-nowrap transition ${
                selectedCategory === 'ALL'
                  ? 'bg-nuit text-brume border-nuit font-semibold'
                  : 'bg-white text-encre/70 border-encre/15 hover:border-seve'
              }`}
            >
              Toutes catégories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full border whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-nuit text-brume border-nuit font-semibold'
                    : 'bg-white text-encre/70 border-encre/15 hover:border-seve'
                }`}
              >
                {cat.name}
              </button>
            ))}
            <span className="ml-auto text-xs text-encre/60 font-mono tabular-nums whitespace-nowrap pl-2">
              {filteredProducts.length} résultat{filteredProducts.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-8 rounded-card border border-wax/30 bg-wax/10 p-4 text-xs text-wax flex items-center justify-between">
          <span>{error}</span>
          <button className="underline font-semibold" onClick={() => setRetryKey((value) => value + 1)}>
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="h-72 rounded-card bg-encre/5 animate-pulse" />
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
          <div className="py-20 text-center rounded-card border border-dashed border-encre/20 bg-white p-8 mt-8">
            <Package className="w-12 h-12 text-encre/30 mx-auto mb-3" />
            <h3 className="text-base font-display font-semibold text-nuit">Aucune offre trouvée</h3>
            <p className="mt-1 text-xs text-encre/60">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
            <button
              onClick={() => {
                setSearch('');
                setQuery('');
                setTypeFilter('ALL');
                setSelectedCategory('ALL');
                setSelectedCity('ALL');
                setFavoritesOnly(false);
                setSearchParams(new URLSearchParams());
              }}
              className="mt-4 px-5 py-2.5 rounded-card bg-seve text-brume font-display font-medium text-xs hover:bg-seve/90 transition"
            >
              Afficher tout le catalogue
            </button>
          </div>
        )
      )}

      {/* Floating Compare Bar */}
      {compareProducts.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 bg-nuit text-brume px-5 py-3 rounded-card shadow-2xl border border-white/15 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-safran" />
            <span className="font-display font-semibold">
              {compareProducts.length} offre{compareProducts.length > 1 ? 's' : ''} sélectionnée{compareProducts.length > 1 ? 's' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-safran text-nuit font-display font-bold hover:bg-safran/90 transition"
          >
            Comparer maintenant
          </button>
        </div>
      )}
    </section>
  );
}
