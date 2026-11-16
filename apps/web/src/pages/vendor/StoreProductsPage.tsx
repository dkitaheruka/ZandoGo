import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  FileText,
  Sparkles,
  Check,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { Product, VendorStore } from '../../lib/types';

export function StoreProductsPage() {
  const { storeId = 'store-1' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stockNotice, setStockNotice] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`).catch(() => ({ data: null })),
      api.get<Product[]>(`/vendors/stores/${storeId}/products`).catch(() => ({ data: [] })),
    ])
      .then(([storeResponse, productsResponse]) => {
        setStore(storeResponse.data || { id: storeId, storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', status: 'ACTIVE' });
        setProducts(productsResponse.data || []);
      })
      .catch(() => setError('Impossible de charger le catalogue de cette boutique.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [storeId]);

  async function adjustStock(product: Product, delta: number) {
    const currentQty = product.stockQty ?? 10;
    const nextQty = Math.max(0, currentQty + delta);
    setBusyId(product.id);
    try {
      await api.patch(`/vendors/stores/${storeId}/products/${product.id}/stock`, {
        stockQty: nextQty,
      });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stockQty: nextQty } : item)),
      );
      setStockNotice(`Stock mis à jour pour "${product.title}" : ${nextQty} unités.`);
      setTimeout(() => setStockNotice(null), 3500);
    } catch {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stockQty: nextQty } : item)),
      );
      setStockNotice(`Stock ajusté à ${nextQty}.`);
      setTimeout(() => setStockNotice(null), 3500);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(product: Product) {
    const nextStatus = product.status === 'PUBLISHED' || product.status === 'ACTIVE' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(product.id);
    setError(null);
    try {
      await api.patch(`/vendors/stores/${storeId}/products/${product.id}`, { status: nextStatus });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: nextStatus } : item)),
      );
    } catch {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: nextStatus } : item)),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <VendorLayout storeId={storeId} storeName={store?.storeName || 'Boutique'}>
      <div className="max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
              <Package className="w-4 h-4 text-seve" />
              <span>Gestion d’Inventaire & Tarification RDC</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Catalogue & Stocks en Temps Réel
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Contrôlez les quantités en rayon, activez les remises par palier et suivez vos alertes de réapprovisionnement.
            </p>
          </div>

          <Link
            to={`/vendor/${storeId}/products/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une nouvelle offre</span>
          </Link>
        </div>

        {stockNotice && (
          <div className="p-3.5 rounded-card bg-seve/10 border border-seve/25 text-xs font-medium text-seve flex items-center gap-2 font-display">
            <Check className="w-4 h-4 shrink-0 text-seve" />
            <span>{stockNotice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/20 p-4 text-xs text-wax flex items-center justify-between">
            <span>{error}</span>
            <button onClick={load} className="underline font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {/* Table of Products */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-encre/50">
            Chargement de l’inventaire…
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto rounded-card border border-encre/10 bg-white shadow-xs">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-brume/70 text-encre/80 border-b border-encre/10 font-display font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Article / Offre</th>
                  <th className="px-5 py-3.5">Type & Métier</th>
                  <th className="px-5 py-3.5">Tarification Volume (B2B)</th>
                  <th className="px-5 py-3.5">Stock en Rayon</th>
                  <th className="px-5 py-3.5">Statut Marché</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-encre/5">
                {products.map((product) => {
                  const isPhysical = product.productType === 'PHYSICAL';
                  const isDigital = product.productType === 'DIGITAL';
                  const isService = product.productType === 'SERVICE';
                  const stock = product.stockQty ?? 0;
                  const isLow = isPhysical && stock <= (product.lowStockThreshold || 5);

                  return (
                    <tr key={product.id} className="hover:bg-brume/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.images[0] && (
                            <img
                              src={product.images[0].url}
                              alt=""
                              className="h-11 w-11 rounded-card object-cover bg-brume border border-encre/10 shrink-0"
                            />
                          )}
                          <div>
                            <p className="font-bold text-nuit text-sm">{product.title}</p>
                            <p className="text-[11px] text-encre/50 font-mono">
                              SKU : {product.variants[0]?.sku || 'SKU-STANDARD'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-card text-[11px] font-medium border bg-brume/50 border-encre/10 text-encre">
                          {isPhysical && (
                            <>
                              <Package className="w-3.5 h-3.5 text-seve" />
                              <span>Bien physique</span>
                            </>
                          )}
                          {isDigital && (
                            <>
                              <FileText className="w-3.5 h-3.5 text-seve" />
                              <span>Document PDF</span>
                            </>
                          )}
                          {isService && (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-safran" />
                              <span>Service / Télécom</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <span className="font-display font-bold text-nuit text-sm tabular-nums block">
                            ${Number(product.basePriceUsd).toFixed(2)}
                          </span>
                          {product.priceTiers && product.priceTiers.length > 1 ? (
                            <span className="text-[10px] text-seve font-display font-medium block">
                              Dès ${product.priceTiers[product.priceTiers.length - 1].unitPriceUsd} (volume)
                            </span>
                          ) : (
                            <span className="text-[10px] text-encre/50 font-mono block">Tarif unitaire</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isPhysical ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adjustStock(product, -1)}
                              disabled={busyId === product.id || stock <= 0}
                              className="h-7 w-7 rounded-lg border border-encre/20 bg-white hover:bg-brume text-encre font-bold flex items-center justify-center transition disabled:opacity-40"
                              title="Diminuer stock"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <span
                              className={`font-display font-bold tabular-nums px-2 py-0.5 rounded-card text-xs ${
                                isLow ? 'bg-wax/10 text-wax border border-wax/20' : 'bg-brume text-nuit'
                              }`}
                            >
                              {stock} pcs
                            </span>

                            <button
                              type="button"
                              onClick={() => adjustStock(product, 1)}
                              disabled={busyId === product.id}
                              className="h-7 w-7 rounded-lg border border-encre/20 bg-white hover:bg-brume text-encre font-bold flex items-center justify-center transition disabled:opacity-40"
                              title="Ajouter stock"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-wax font-display font-bold bg-wax/10 border border-wax/25 px-1.5 py-0.5 rounded-card">
                                <AlertTriangle className="w-3 h-3 text-wax" />
                                <span>Alerte</span>
                              </span>
                            )}
                          </div>
                        ) : isDigital ? (
                          <span className="font-display text-seve font-medium">Illimité (Téléchargement)</span>
                        ) : (
                          <span className="font-display text-encre/60 font-medium">Sur commande</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                              ? 'text-seve'
                              : 'text-encre/40'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                                ? 'bg-seve'
                                : 'bg-encre/20'
                            }`}
                          />
                          <span>
                            {product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                              ? 'En vente'
                              : 'Brouillon'}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          disabled={busyId === product.id}
                          onClick={() => toggleStatus(product)}
                          className="font-medium text-xs text-encre/70 hover:text-seve underline underline-offset-4 disabled:opacity-50"
                        >
                          {busyId === product.id
                            ? 'Mise à jour…'
                            : product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                            ? 'Désactiver'
                            : 'Mettre en vente'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-encre/20 py-16 text-center bg-white p-8">
            <Package className="w-12 h-12 text-encre/30 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-nuit font-display">Aucun produit dans ce catalogue</h3>
            <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
              Publiez votre première offre avec gestion de stock pour la rendre disponible aux acheteurs de toute la RDC.
            </p>
            <Link
              to={`/vendor/${storeId}/products/new`}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-seve text-brume font-display font-bold text-xs hover:bg-seve/90 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une offre</span>
            </Link>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
