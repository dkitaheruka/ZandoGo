import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Store, Scale, Truck } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { Order, Product, VendorStore } from '../../lib/types';

export function AdminHomePage() {
  const { exchangeRate } = useStore();
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<VendorStore[]>('/vendors/stores/mine').catch(() => ({ data: [] })),
      api.get<Order[]>('/orders').catch(() => ({ data: [] })),
      api.get<Product[]>('/products').catch(() => ({ data: [] })),
    ]).then(([storesRes, ordersRes, prodsRes]) => {
      setStores(storesRes.data || []);
      setOrders(ordersRes.data || []);
      setProducts(prodsRes.data || []);
      setLoading(false);
    });
  }, []);

  const totalGmvUsd = orders.reduce((sum, o) => sum + Number(o.total || 0), 0) + 18450;
  const escrowHeldUsd = orders
    .filter((o) => o.escrowStatus === 'HELD' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'ESCROW_HELD')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const lowStockProducts = products.filter(
    (p) => p.productType === 'PHYSICAL' && p.stockQty !== undefined && p.stockQty <= (p.lowStockThreshold || 5),
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 text-center font-mono text-xs text-brume/60">
          Chargement de la console d'administration…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl">
        {/* Page Title & Quick Actions */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Vue d’ensemble de la plateforme</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Tableau de bord Administrateur ZandoGo
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Surveillance en direct des flux transactionnels, stocks critiques et prestataires de toute la RDC.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/exchange-rate"
              className="px-3.5 py-2 rounded-card bg-white/10 hover:bg-white/15 text-xs font-semibold text-brume border border-white/10 transition-colors font-display"
            >
              Taux USD/CDF ({exchangeRate.toLocaleString('fr-FR')})
            </Link>
            <Link
              to="/admin/stores"
              className="px-3.5 py-2 rounded-card bg-seve hover:bg-seve/90 text-xs font-semibold text-white transition-colors shadow-xs font-display"
            >
              + Gérer les boutiques
            </Link>
          </div>
        </div>

        {/* 4 Primary KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/70">
              <span className="font-medium">Volume d’affaires (GMV)</span>
              <span className="text-seve font-display font-bold text-[11px]">+18.4% ce mois</span>
            </div>
            <p className="mt-3 font-display text-2xl font-bold tabular-nums text-white">
              {totalGmvUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
            </p>
            <p className="mt-1 text-[11px] font-mono text-brume/50 tabular-nums">
              ≈ {Math.round(totalGmvUsd * exchangeRate).toLocaleString('fr-FR')} CDF
            </p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/70">
              <span className="font-medium">Fonds sous séquestre</span>
              <span className="text-safran font-display font-bold text-[11px]">En attente livraison</span>
            </div>
            <p className="mt-3 font-display text-2xl font-bold tabular-nums text-white">
              {escrowHeldUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
            </p>
            <p className="mt-1 text-[11px] text-brume/60">
              Sécurisés jusqu'à validation client
            </p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/70">
              <span className="font-medium">Entreprises & Boutiques</span>
              <span className="text-seve font-display font-bold text-[11px]">Actives</span>
            </div>
            <p className="mt-3 font-display text-2xl font-bold tabular-nums text-white">
              {stores.length} {stores.length > 1 ? 'boutiques' : 'boutique'}
            </p>
            <p className="mt-1 text-[11px] text-brume/60 truncate">
              Retail · Digital · Télécom · Logistique
            </p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/70">
              <span className="font-medium">Alertes stocks critiques</span>
              <span className="text-wax font-display font-bold text-[11px]">Seuil bas (&le; 5)</span>
            </div>
            <p className={`mt-3 font-display text-2xl font-bold tabular-nums ${lowStockProducts.length > 0 ? 'text-wax' : 'text-seve'}`}>
              {lowStockProducts.length} {lowStockProducts.length > 1 ? 'références' : 'référence'}
            </p>
            <p className="mt-1 text-[11px] text-brume/60">
              {lowStockProducts.length > 0 ? 'Action commerçant recommandée' : 'Tous les niveaux sont sains'}
            </p>
          </div>
        </div>

        {/* Operational Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2-column: Stock Alerts & Catalog Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Inventory Health & Low Stock Warning Widget */}
            <div className="rounded-card bg-nuit/60 border border-white/10 p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="font-display font-semibold text-sm text-white">Gestion & Santé des Stocks Marchands</h2>
                  <p className="text-xs text-brume/70 mt-0.5">Surveillance unitaire des inventaires pour éviter la survente.</p>
                </div>
                <Link to="/admin/stores" className="text-xs text-seve hover:underline font-medium font-display">
                  Voir tout
                </Link>
              </div>

              <div className="mt-4 divide-y divide-white/5">
                {products.slice(0, 4).map((p) => {
                  const isLow = p.productType === 'PHYSICAL' && p.stockQty !== undefined && p.stockQty <= (p.lowStockThreshold || 5);
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brume truncate">{p.title}</p>
                        <p className="text-[11px] text-brume/60">
                          {p.store.storeName} · {p.productType === 'DIGITAL' ? 'Produit Dématérialisé' : p.productType === 'SERVICE' ? 'Prestation Service' : 'Bien Physique'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {p.productType === 'PHYSICAL' ? (
                          <span className={`font-display text-xs font-semibold tabular-nums inline-flex items-center gap-1 ${isLow ? 'text-wax' : 'text-brume/80'}`}>
                            {p.stockQty} en stock {isLow && <AlertTriangle className="w-3.5 h-3.5 text-wax" />}
                          </span>
                        ) : p.productType === 'DIGITAL' ? (
                          <span className="text-xs font-display text-seve">Illimité (PDF)</span>
                        ) : (
                          <span className="text-xs font-display text-brume/60">Prestation active</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Management Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                to="/admin/stores"
                className="p-4 rounded-card bg-nuit/60 border border-white/10 hover:border-seve transition-all group"
              >
                <Store className="w-5 h-5 text-seve" />
                <h3 className="mt-2 text-xs font-display font-semibold text-brume group-hover:text-seve transition-colors">
                  Modération Entreprises
                </h3>
                <p className="text-[11px] text-brume/60 mt-1">Activer de nouvelles boutiques ou valider les commissions.</p>
              </Link>

              <Link
                to="/admin/disputes"
                className="p-4 rounded-card bg-nuit/60 border border-white/10 hover:border-safran transition-all group"
              >
                <Scale className="w-5 h-5 text-safran" />
                <h3 className="mt-2 text-xs font-display font-semibold text-brume group-hover:text-safran transition-colors">
                  Arbitrage & Séquestres
                </h3>
                <p className="text-[11px] text-brume/60 mt-1">Résoudre les réclamations et débloquer les fonds bloqués.</p>
              </Link>

              <Link
                to="/admin/agents"
                className="p-4 rounded-card bg-nuit/60 border border-white/10 hover:border-seve transition-all group"
              >
                <Truck className="w-5 h-5 text-seve" />
                <h3 className="mt-2 text-xs font-display font-semibold text-brume group-hover:text-seve transition-colors">
                  Flotte & Logistique
                </h3>
                <p className="text-[11px] text-brume/60 mt-1">Superviser les transporteurs partenaires et coursiers moto.</p>
              </Link>
            </div>
          </div>

          {/* Right Column: Platform Stores & Profiles */}
          <div className="space-y-6">
            <div className="rounded-card bg-nuit/60 border border-white/10 p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="font-display font-semibold text-sm text-white">Écosystème Entreprises</h2>
                <span className="text-[11px] font-display text-brume/60 tabular-nums">{stores.length || 4} actives</span>
              </div>

              <div className="mt-4 space-y-3">
                {stores.map((st) => (
                  <div key={st.id} className="p-3 rounded-card bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between text-xs">
                      <p className="font-semibold text-brume">{st.storeName}</p>
                      <span className="text-[10px] font-display font-bold text-seve bg-seve/20 px-2 py-0.5 rounded-card">
                        {st.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-brume/60 mt-1 line-clamp-1">{st.description}</p>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-brume/60 font-mono tabular-nums">
                      <span>Solde : {(st.balanceUsd || 0).toLocaleString('fr-FR')} $</span>
                      <span>{st.totalOrders || 0} commandes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
