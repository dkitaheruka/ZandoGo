import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Package,
  Handshake,
  DollarSign,
  TrendingUp,
  Plus,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { VendorStore } from '../../lib/types';

export function VendorDashboardPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setStores(data || []))
      .catch(() => setError('Impossible de charger vos boutiques.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <VendorLayout storeId={stores[0]?.id || 'store-1'} storeName={stores[0]?.storeName || 'Mes Boutiques'}>
      <div className="max-w-6xl space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Tableau de Bord Vendeur & Grossiste RDC</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
              Espace Marchand ZandoGo
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Pilotez vos stocks, négociez les prix en direct et suivez vos livraisons sur toute la République.
            </p>
          </div>

          <Link
            to="/vendor/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ouvrir une nouvelle boutique</span>
          </Link>
        </div>

        {/* 4 Light KPI Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Chiffre d’Affaires Total</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums font-mono">
              $1,840.50
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+18.5% ce mois-ci</span>
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Commandes Traitées</span>
              <Truck className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums font-mono">
              142
            </p>
            <span className="mt-1 block text-[11px] text-slate-400">
              Livrées via coursiers & fret national
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Négociations en Direct</span>
              <Handshake className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums font-mono">
              2 en cours
            </p>
            <Link
              to={`/vendor/${stores[0]?.id || 'store-1'}/negotiations`}
              className="mt-1 block text-[11px] text-cyan-700 font-semibold hover:underline"
            >
              Répondre aux offres &rarr;
            </Link>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>État des Stocks</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums font-mono">
              1 alerte stock
            </p>
            <span className="mt-1 block text-[11px] text-cyan-800 font-medium">
              Réapprovisionnement suggéré
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={load} className="underline font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {/* Stores Grid */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Vos Espaces Commerciaux Enregistrés
          </h2>

          {loading ? (
            <div className="py-20 text-center text-xs font-mono text-slate-400">
              Chargement de vos boutiques…
            </div>
          ) : stores.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          {store.storeName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active & Vérifiée
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">/{store.slug}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Solde séquestre</span>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        ${(store.balanceUsd || 1840.5).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {store.description || 'Commerce grossiste et détail sur la place de marché ZandoGo.'}
                  </p>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/vendor/${store.id}/products`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Gérer les stocks</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/negotiations`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition"
                      >
                        <Handshake className="w-3.5 h-3.5 text-slate-400" />
                        <span>Négociations B2B</span>
                      </Link>
                    </div>

                    <Link
                      to="/products"
                      target="_blank"
                      className="text-slate-400 hover:text-slate-600"
                      title="Voir sur le site public"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center bg-white p-8">
              <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">Aucune boutique active</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Ouvrez votre première boutique pour commencer à vendre des produits physiques, digitaux ou des services.
              </p>
              <Link
                to="/vendor/new"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white font-medium text-xs hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                <span>Créer ma boutique</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
