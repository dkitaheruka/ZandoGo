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
  ShoppingBag,
  BadgeCheck,
  Megaphone,
  CheckCircle2,
  CreditCard,
  Lock,
  FileText,
  Sparkles,
  BarChart3,
  Zap,
  Trash2,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { PaymentOperatorStrip } from '../../components/PaymentOperatorLogos';
import { api } from '../../lib/api';
import type {
  NegotiationOffer,
  PlatformPricing,
  Product,
  StoreServiceModule,
  TransportDestination,
  VendorStore,
  WalletSummary,
} from '../../lib/types';

const SALES_TREND_7D = [
  { day: 'Lun', amount: 185 },
  { day: 'Mar', amount: 240 },
  { day: 'Mer', amount: 195 },
  { day: 'Jeu', amount: 310 },
  { day: 'Ven', amount: 280 },
  { day: 'Sam', amount: 420 },
  { day: 'Dim', amount: 360 },
];

export function VendorDashboardPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>('store-1');
  const [pricing, setPricing] = useState<PlatformPricing | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [pendingNegoCount, setPendingNegoCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdPlan, setSelectedAdPlan] = useState<'ESSENTIAL_29' | 'PRO_CAROUSEL_59'>('PRO_CAROUSEL_59');
  const [certBilling, setCertBilling] = useState<'MONTHLY' | 'QUARTERLY'>('MONTHLY');
  const [billingBusy, setBillingBusy] = useState<'AD' | 'CERT' | StoreServiceModule | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [isTransportAgencyDraft, setIsTransportAgencyDraft] = useState(false);
  const [destinationsDraft, setDestinationsDraft] = useState<TransportDestination[]>([]);
  const [savingDestinations, setSavingDestinations] = useState(false);

  function load(selectedId?: string) {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore[]>('/vendors/stores/mine'),
      api.get<PlatformPricing>('/platform/pricing').catch(() => ({ data: null })),
    ])
      .then(async ([storesRes, pricingRes]) => {
        const list = storesRes.data || [];
        setStores(list);
        if (pricingRes.data) setPricing(pricingRes.data);

        const targetId =
          selectedId && list.some((s) => s.id === selectedId)
            ? selectedId
            : list.some((s) => s.id === activeStoreId)
            ? activeStoreId
            : list[0]?.id || 'store-1';
        setActiveStoreId(targetId);

        const [walRes, ordRes, negRes, prodRes] = await Promise.all([
          api.get<WalletSummary>(`/wallets/mine?storeId=${targetId}`).catch(() => ({ data: null })),
          api.get<any[]>(`/vendors/stores/${targetId}/orders`).catch(() => ({ data: [] })),
          api.get<NegotiationOffer[]>('/negotiations').catch(() => ({ data: [] })),
          api.get<Product[]>('/products').catch(() => ({ data: [] })),
        ]);

        if (walRes.data) setWallet(walRes.data);
        setOrdersCount((ordRes.data || []).length);
        setPendingNegoCount((negRes.data || []).filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length);
        setLowStockCount(
          (prodRes.data || []).filter(
            (p) =>
              p.store?.id === targetId &&
              p.productType === 'PHYSICAL' &&
              p.stockQty !== undefined &&
              p.stockQty <= (p.lowStockThreshold || 5),
          ).length,
        );
      })
      .catch(() => setError('Impossible de charger vos boutiques.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const primaryStore = stores.find((s) => s.id === activeStoreId) || stores[0];
  const primaryStoreId = primaryStore?.id || activeStoreId;

  useEffect(() => {
    if (primaryStore) {
      setIsTransportAgencyDraft(Boolean(primaryStore.isTransportAgency));
      setDestinationsDraft(primaryStore.transportDestinations || []);
    }
  }, [primaryStore?.id, primaryStore?.isTransportAgency]);
  const blockedStores = stores.filter((s) => s.payoutBlocked);
  const totalBalance = wallet
    ? wallet.availableBalanceUsd + wallet.lockedEscrowUsd
    : primaryStore?.balanceUsd ?? 0;
  const maxTrend = Math.max(...SALES_TREND_7D.map((d) => d.amount));

  const adEssentialPrice = pricing?.adEssentialMonthlyFeeUsd ?? 29;
  const adProPrice = pricing?.adProCarouselMonthlyFeeUsd ?? 59;
  const certMonthlyPrice = pricing?.certificationMonthlyFeeUsd ?? 15;
  const certQuarterlyPrice = pricing?.certificationQuarterlyFeeUsd ?? 39;

  async function handleSubscribeMonthlyAd() {
    setBillingBusy('AD');
    setBillingNotice(null);
    try {
      const { data } = await api.post<{ store: VendorStore; paymentRef?: string; feeUsd: number }>(
        `/vendors/stores/${primaryStoreId}/subscribe-ad`,
        { plan: selectedAdPlan },
      );
      setStores((prev) => prev.map((s) => (s.id === data.store.id ? data.store : s)));
      setBillingNotice(
        `Publicité mensuelle activée pour « ${data.store.storeName} » (${data.paymentRef || 'OK'} · $${data.feeUsd}/mois).`,
      );
    } catch {
      setBillingNotice('Impossible d’activer la publicité mensuelle pour le moment.');
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleSubscribeCertification() {
    setBillingBusy('CERT');
    setBillingNotice(null);
    try {
      const { data } = await api.post<{ store: VendorStore; paymentRef?: string; feeUsd: number }>(
        `/vendors/stores/${primaryStoreId}/subscribe-certification`,
        { billing: certBilling },
      );
      setStores((prev) => prev.map((s) => (s.id === data.store.id ? data.store : s)));
      setBillingNotice(
        `Certification Vendeur payée pour « ${data.store.storeName} » (${data.paymentRef || 'OK'} · $${data.feeUsd}).`,
      );
    } catch {
      setBillingNotice('Impossible d’activer la certification pour le moment.');
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleActivateServiceModule(service: StoreServiceModule) {
    setBillingBusy(service);
    setBillingNotice(null);
    try {
      const { data } = await api.post<{
        store: VendorStore;
        activatedService: StoreServiceModule;
        feeUsd: number;
        paymentRef?: string;
      }>(`/vendors/stores/${primaryStoreId}/activate-service`, { service });
      setStores((prev) => prev.map((s) => (s.id === data.store.id ? data.store : s)));
      const label =
        service === 'PHYSICAL'
          ? 'Biens Physiques'
          : service === 'DIGITAL'
          ? 'Livres & Documents PDF'
          : 'Services & Transport au km';
      setBillingNotice(
        `Module « ${label} » payé et activé pour « ${data.store.storeName} » (${data.paymentRef || 'OK'} · $${data.feeUsd}).`,
      );
    } catch {
      setBillingNotice('Impossible d’activer ce module pour le moment.');
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleSaveTransportRoutes() {
    if (!primaryStore) return;
    setSavingDestinations(true);
    setBillingNotice(null);
    try {
      const cleaned = isTransportAgencyDraft
        ? destinationsDraft.filter((d) => d.originCity.trim() && d.destinationCity.trim())
        : [];
      const { data } = await api.patch<VendorStore>(`/vendors/stores/${primaryStore.id}`, {
        isTransportAgency: isTransportAgencyDraft,
        transportDestinations: cleaned,
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === primaryStore.id
            ? {
                ...s,
                ...(data || {}),
                isTransportAgency: isTransportAgencyDraft,
                transportDestinations: cleaned,
              }
            : s,
        ),
      );
      setBillingNotice(
        `Destinations Agence de Transport mises à jour pour « ${primaryStore.storeName} » (${cleaned.length} ligne(s)).`,
      );
    } catch {
      setBillingNotice('Impossible d’enregistrer les destinations de transport.');
    } finally {
      setSavingDestinations(false);
    }
  }

  const activeStoreServices: StoreServiceModule[] = primaryStore?.enabledServices?.length
    ? primaryStore.enabledServices
    : ['PHYSICAL'];

  const storeModulesMeta: {
    key: StoreServiceModule;
    label: string;
    desc: string;
    priceUsd: number;
    icon: typeof Package;
  }[] = [
    {
      key: 'PHYSICAL',
      label: 'Biens Physiques',
      desc: 'Stock, variantes (tailles & couleurs personnalisées) et livraison.',
      priceUsd: pricing?.servicePhysicalFeeUsd ?? 15,
      icon: Package,
    },
    {
      key: 'DIGITAL',
      label: 'Livres & Documents PDF',
      desc: 'Envoi automatique du lien de téléchargement après paiement client.',
      priceUsd: pricing?.serviceDigitalFeeUsd ?? 10,
      icon: FileText,
    },
    {
      key: 'SERVICE',
      label: 'Services & Transport au km',
      desc: 'Prestations facturées au kilomètre, à l’heure ou au forfait.',
      priceUsd: pricing?.servicePrestationFeeUsd ?? 20,
      icon: Sparkles,
    },
  ];

  return (
    <VendorLayout storeId={primaryStoreId} storeName={primaryStore?.storeName || 'Mes Boutiques'}>
      <div className="max-w-6xl space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-nuit uppercase tracking-wider">
              <Store className="w-4 h-4 text-safran" />
              <span>Tableau de Bord Multi-Boutiques & Grossiste RDC</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Espace Marchand ZandoGo
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Achetez une ou plusieurs boutiques, publiez vos produits dans chaque boutique et gérez vos abonnements (tarifs fixés dans la console admin).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stores.length > 1 && (
              <select
                value={primaryStoreId}
                onChange={(e) => load(e.target.value)}
                aria-label="Boutique active"
                className="px-3 py-2.5 rounded-card border border-encre/15 bg-white text-xs font-display font-bold text-nuit outline-none focus:border-safran"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    Boutique : {s.storeName}
                  </option>
                ))}
              </select>
            )}
            <Link
              to={`/vendor/${primaryStoreId}/analytics`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card border border-seve/35 bg-seve/10 hover:bg-seve/20 text-seve font-display font-bold text-xs transition"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analyses & Diagrammes</span>
            </Link>
            <Link
              to={`/vendor/${primaryStoreId}/products/new`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card border border-encre/15 bg-white hover:border-safran text-nuit font-display font-bold text-xs transition"
            >
              <Plus className="w-4 h-4 text-safran" />
              <span>Publier un produit</span>
            </Link>
            <Link
              to="/vendor/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold text-xs transition shadow-xs"
            >
              <Store className="w-4 h-4" />
              <span>
                Acheter une boutique {pricing ? `($${pricing.storeCreationFeeUsd})` : ''}
              </span>
            </Link>
          </div>
        </div>

        {/* Payout Blocked Warning Banner */}
        {blockedStores.length > 0 && (
          <div className="rounded-card bg-wax/10 border border-wax/35 p-4 text-xs text-wax flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold">
                  Retraits temporairement bloqués sur : {blockedStores.map((s) => s.storeName).join(', ')}
                </p>
                <p className="text-encre/80 mt-0.5">
                  {blockedStores[0].payoutBlockReason ||
                    'Un litige client pertinent est en cours d’arbitrage par l’administration.'}
                </p>
              </div>
            </div>
            <Link
              to={`/vendor/${blockedStores[0].id}/orders`}
              className="px-3.5 py-1.5 rounded-card bg-wax text-white font-display font-bold text-xs"
            >
              Voir les détails
            </Link>
          </div>
        )}

        {/* 4 Dynamic KPI Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Portefeuille ({primaryStore?.storeName || 'Boutique'})</span>
              <DollarSign className="w-4 h-4 text-seve" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-seve font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>Disponible : ${(wallet?.availableBalanceUsd ?? totalBalance).toFixed(2)}</span>
            </span>
            {wallet?.immediateWithdrawalAuthorized && (
              <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seve/15 text-seve text-[10px] font-display font-bold">
                <Zap className="w-3 h-3 text-safran" />
                <span>Retrait immédiat activé par Super Admin</span>
              </span>
            )}
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Commandes Boutique</span>
              <Truck className="w-4 h-4 text-safran" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {ordersCount} {ordersCount > 1 ? 'commandes' : 'commande'}
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/orders`}
              className="mt-1 block text-[11px] text-nuit font-semibold hover:underline"
            >
              Expédier & retraits &rarr;
            </Link>
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Négociations B2B</span>
              <Handshake className="w-4 h-4 text-safran" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {pendingNegoCount} en attente
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/negotiations`}
              className="mt-1 block text-[11px] text-nuit font-semibold hover:underline"
            >
              Répondre aux offres &rarr;
            </Link>
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>État des Stocks</span>
              <Package className="w-4 h-4 text-wax" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {lowStockCount} {lowStockCount > 1 ? 'alertes stock' : 'alerte stock'}
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/products`}
              className="mt-1 block text-[11px] text-wax font-medium hover:underline"
            >
              {lowStockCount > 0 ? 'Réapprovisionnement suggéré →' : 'Inventaire optimal ✓'}
            </Link>
          </div>
        </div>

        {/* Paid Store Service Modules (À la carte activation) */}
        {primaryStore && (
          <div className="rounded-card bg-white border border-encre/10 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-nuit">
                  Services & Modules de la Boutique — {primaryStore.storeName}
                </h2>
                <p className="text-xs text-encre/65">
                  Les services non choisis lors de l’achat de la boutique restent verrouillés jusqu’à leur activation payante par Mobile Money ou Carte (tarifs configurés par l’admin).
                </p>
              </div>
              <span className="text-[11px] font-mono text-seve font-semibold">
                {activeStoreServices.length}/3 service(s) actif(s)
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {storeModulesMeta.map((mod) => {
                const Icon = mod.icon;
                const enabled = activeStoreServices.includes(mod.key);
                return (
                  <div
                    key={mod.key}
                    className={`p-4 rounded-card border flex flex-col justify-between gap-3 ${
                      enabled ? 'border-seve/35 bg-seve/5' : 'border-encre/15 bg-brume/40'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-display font-bold text-xs text-nuit">
                          <Icon className={`w-4 h-4 ${enabled ? 'text-seve' : 'text-encre/50'}`} />
                          <span>{mod.label}</span>
                        </span>
                        {enabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seve text-brume text-[10px] font-display font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activé</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-encre/10 text-encre/70 text-[10px] font-mono">
                            <Lock className="w-2.5 h-2.5" />
                            <span>${mod.priceUsd}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-encre/70 leading-relaxed">{mod.desc}</p>
                    </div>

                    {enabled ? (
                      <Link
                        to={`/vendor/${primaryStoreId}/products/new?type=${mod.key}`}
                        className="w-full text-center px-3 py-2 rounded-card bg-white border border-seve/30 text-seve hover:bg-seve hover:text-brume font-display font-bold text-[11px] transition"
                      >
                        Publier ({mod.label}) &rarr;
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={billingBusy === mod.key || !pricing}
                        onClick={() => handleActivateServiceModule(mod.key)}
                        className="w-full px-3 py-2 rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold text-[11px] transition disabled:opacity-50 shadow-xs"
                      >
                        {billingBusy === mod.key
                          ? 'Activation en cours…'
                          : `Activer ce service ($${mod.priceUsd.toFixed(2)})`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transport Agency Routes & Destinations Management */}
        {primaryStore && (
          <div className="rounded-card bg-white border border-encre/10 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-nuit flex items-center gap-2">
                  <Truck className="w-4 h-4 text-seve" />
                  <span>Agence de Transport & Lignes Nationales RDC — {primaryStore.storeName}</span>
                </h2>
                <p className="text-xs text-encre/65">
                  Les agences de transport peuvent déclarer ici leurs différentes destinations, tarifs et délais à travers tout le pays.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-display font-bold text-nuit cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTransportAgencyDraft}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsTransportAgencyDraft(next);
                    if (next && destinationsDraft.length === 0) {
                      setDestinationsDraft([
                        {
                          id: `dest-${Date.now()}`,
                          originCity: 'Goma',
                          destinationCity: 'Bukavu',
                          basePriceUsd: 18,
                          pricePerKmUsd: 0.45,
                          estimatedDelay: '6h - 12h',
                          vehicleMode: 'Cargo / Express',
                        },
                      ]);
                    }
                  }}
                  className="accent-seve h-4 w-4"
                />
                <span>Activer le profil Agence de Transport</span>
              </label>
            </div>

            {isTransportAgencyDraft && (
              <div className="space-y-3 pt-2 border-t border-encre/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-encre/65">
                    {destinationsDraft.length} destination(s) configurée(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDestinationsDraft((prev) => [
                          ...prev,
                          {
                            id: `dest-${Date.now()}`,
                            originCity: 'Goma',
                            destinationCity: '',
                            basePriceUsd: 20,
                            pricePerKmUsd: 0.5,
                            estimatedDelay: '24h - 48h',
                            vehicleMode: 'Camion / Fret',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-card border border-encre/20 bg-brume/50 text-xs font-display font-bold text-nuit hover:border-seve"
                    >
                      <Plus className="w-3.5 h-3.5 text-seve" />
                      <span>Nouvelle destination</span>
                    </button>
                    <button
                      type="button"
                      disabled={savingDestinations}
                      onClick={handleSaveTransportRoutes}
                      className="px-4 py-1.5 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-bold transition disabled:opacity-50"
                    >
                      {savingDestinations ? 'Enregistrement…' : 'Enregistrer les destinations'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {destinationsDraft.map((dest) => (
                    <div
                      key={dest.id}
                      className="grid sm:grid-cols-6 gap-2 p-3 rounded-card bg-brume/40 border border-encre/10 text-xs items-center"
                    >
                      <input
                        type="text"
                        placeholder="Départ"
                        value={dest.originCity}
                        onChange={(e) =>
                          setDestinationsDraft((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, originCity: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Destination"
                        value={dest.destinationCity}
                        onChange={(e) =>
                          setDestinationsDraft((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, destinationCity: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Véhicule / Mode"
                        value={dest.vehicleMode}
                        onChange={(e) =>
                          setDestinationsDraft((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, vehicleMode: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="number"
                        min={1}
                        step="0.5"
                        placeholder="Base ($)"
                        value={dest.basePriceUsd}
                        onChange={(e) =>
                          setDestinationsDraft((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, basePriceUsd: Number(e.target.value) } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 bg-white px-2.5 py-1.5 text-xs font-bold outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Délai"
                        value={dest.estimatedDelay}
                        onChange={(e) =>
                          setDestinationsDraft((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, estimatedDelay: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setDestinationsDraft((prev) => prev.filter((d) => d.id !== dest.id))
                          }
                          className="p-1.5 text-wax hover:bg-wax/10 rounded-lg"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isTransportAgencyDraft && primaryStore.isTransportAgency && (
              <button
                type="button"
                disabled={savingDestinations}
                onClick={handleSaveTransportRoutes}
                className="px-4 py-1.5 rounded-card bg-wax text-white text-xs font-display font-bold"
              >
                Confirmer la désactivation du profil agence
              </button>
            )}
          </div>
        )}

        {/* Paid Certification & Monthly Ad Visibility Section (Dynamic Admin Pricing) */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Paid Monthly Advertising Card */}
          <div className="rounded-card bg-nuit text-brume p-6 border border-safran/35 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-safran">
                  <Megaphone className="w-4 h-4" />
                  <span>Publicité Mensuelle — {primaryStore?.storeName}</span>
                </span>
                <h2 className="font-display text-lg font-bold text-brume mt-1">
                  Carrousel d’Accueil & Top Catalogue
                </h2>
              </div>
              {primaryStore?.hasMonthlyAd ? (
                <span className="px-2.5 py-1 rounded-full bg-safran text-nuit text-[10px] font-display font-extrabold uppercase">
                  Sponsoring Actif
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-brume/80 text-[10px] font-mono">
                  Non activé
                </span>
              )}
            </div>

            <p className="text-xs text-brume/75 leading-relaxed">
              Les boutiques abonnées à la publicité mensuelle voient leurs produits <strong>défiler sur le carrousel d’accueil</strong> et apparaître <strong>en premier dans tout le catalogue</strong>.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedAdPlan('ESSENTIAL_29')}
                className={`p-3 rounded-card border text-left transition ${
                  selectedAdPlan === 'ESSENTIAL_29'
                    ? 'border-safran bg-white/10'
                    : 'border-white/15 bg-white/5 hover:border-white/30'
                }`}
              >
                <span className="font-display font-bold text-brume block">Pack Priorité Catalogue</span>
                <span className="font-display text-base font-extrabold text-safran tabular-nums">
                  ${adEssentialPrice} / mois
                </span>
                <span className="block text-[10px] text-brume/65 mt-0.5">Affichage en tête des filtres & recherches</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAdPlan('PRO_CAROUSEL_59')}
                className={`p-3 rounded-card border text-left transition ${
                  selectedAdPlan === 'PRO_CAROUSEL_59'
                    ? 'border-safran bg-white/10'
                    : 'border-white/15 bg-white/5 hover:border-white/30'
                }`}
              >
                <span className="font-display font-bold text-brume block">Pack Vitrine + Carrousel</span>
                <span className="font-display text-base font-extrabold text-safran tabular-nums">
                  ${adProPrice} / mois
                </span>
                <span className="block text-[10px] text-brume/65 mt-0.5">Carrousel page d’accueil + Top catalogue</span>
              </button>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <PaymentOperatorStrip compact dark />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-brume/65 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-safran" />
                  <span>Airtel, M-Pesa, Orange, MTN, Visa + alerte SMS</span>
                </span>
              <button
                type="button"
                disabled={billingBusy === 'AD' || !pricing}
                onClick={handleSubscribeMonthlyAd}
                className="px-4 py-2 rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold text-xs transition disabled:opacity-50"
              >
                {billingBusy === 'AD'
                  ? 'Activation…'
                  : primaryStore?.hasMonthlyAd
                  ? `Renouveler ($${selectedAdPlan === 'ESSENTIAL_29' ? adEssentialPrice : adProPrice}/mois)`
                  : `Activer la publicité ($${selectedAdPlan === 'ESSENTIAL_29' ? adEssentialPrice : adProPrice}/mois)`}
              </button>
              </div>
            </div>
          </div>

          {/* Paid Vendor Certification Card */}
          <div className="rounded-card bg-white p-6 border border-seve/30 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-seve">
                  <BadgeCheck className="w-4 h-4" />
                  <span>Certification Vendeur — {primaryStore?.storeName}</span>
                </span>
                <h2 className="font-display text-lg font-bold text-nuit mt-1">
                  Badge « Vendeur Certifié » sur Tous Vos Produits
                </h2>
              </div>
              {primaryStore?.isCertified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-seve/10 text-seve border border-seve/30 text-[10px] font-display font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Certifié Actif</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-encre/5 text-encre/60 text-[10px] font-mono">
                  Non certifié
                </span>
              )}
            </div>

            <p className="text-xs text-encre/75 leading-relaxed">
              Après vérification RCCM / KYC, cet abonnement (tarif configuré par l’admin) affiche le sceau <strong>« Vendeur Certifié »</strong> sur toutes les fiches produits de cette boutique.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setCertBilling('MONTHLY')}
                className={`p-3 rounded-card border text-left transition ${
                  certBilling === 'MONTHLY'
                    ? 'border-seve bg-seve/5'
                    : 'border-encre/15 bg-brume/40 hover:border-seve/40'
                }`}
              >
                <span className="font-display font-bold text-nuit block">Certification Mensuelle</span>
                <span className="font-display text-base font-extrabold text-seve tabular-nums">
                  ${certMonthlyPrice} / mois
                </span>
                <span className="block text-[10px] text-encre/60 mt-0.5">Badge vérifié sur chaque produit</span>
              </button>

              <button
                type="button"
                onClick={() => setCertBilling('QUARTERLY')}
                className={`p-3 rounded-card border text-left transition ${
                  certBilling === 'QUARTERLY'
                    ? 'border-seve bg-seve/5'
                    : 'border-encre/15 bg-brume/40 hover:border-seve/40'
                }`}
              >
                <span className="font-display font-bold text-nuit block">Certification Trimestrielle</span>
                <span className="font-display text-base font-extrabold text-seve tabular-nums">
                  ${certQuarterlyPrice} / 3 mois
                </span>
                <span className="block text-[10px] text-encre/60 mt-0.5">Audit RCCM inclus · Durée 90 jours</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-encre/10">
              <Link to="/kyc" className="text-[11px] font-semibold text-seve hover:underline">
                Vérifier mon dossier RCCM / KYC &rarr;
              </Link>
              <button
                type="button"
                disabled={billingBusy === 'CERT' || !pricing}
                onClick={handleSubscribeCertification}
                className="px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition disabled:opacity-50"
              >
                {billingBusy === 'CERT'
                  ? 'Traitement en cours…'
                  : primaryStore?.isCertified
                  ? `Prolonger Certification ($${certBilling === 'QUARTERLY' ? certQuarterlyPrice : certMonthlyPrice})`
                  : `Payer la certification ($${certBilling === 'QUARTERLY' ? certQuarterlyPrice : certMonthlyPrice})`}
              </button>
            </div>
          </div>
        </div>

        {billingNotice && (
          <div className="rounded-card bg-seve/10 border border-seve/30 p-4 text-xs text-seve font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{billingNotice}</span>
          </div>
        )}

        {/* 7-day Performance Analytics Widget */}
        <div className="rounded-card bg-white border border-encre/10 p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-sm font-bold text-nuit">
                Tendance des ventes sur 7 jours (USD)
              </h2>
              <p className="text-xs text-encre/60">
                Volume journalier validé en gros B2B & détail sur ZandoGo
              </p>
            </div>
            <Link
              to={`/vendor/${primaryStoreId}/orders`}
              className="text-xs font-semibold text-nuit hover:underline"
            >
              Gérer mes retraits Mobile Money &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-3 items-end h-32 pt-4">
            {SALES_TREND_7D.map((bar) => {
              const pct = Math.max(18, Math.round((bar.amount / maxTrend) * 100));
              return (
                <div key={bar.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono text-encre/60">${bar.amount}</span>
                  <div className="w-full max-w-[44px] bg-brume rounded-t-lg overflow-hidden flex items-end h-20">
                    <div
                      className="w-full bg-safran hover:bg-nuit transition-colors rounded-t-lg"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-display font-semibold text-nuit">{bar.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/20 p-4 text-xs text-wax flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => load()} className="underline font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {/* Multi-Stores Grid */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-encre/60 font-display">
              Vos Boutiques Enregistrées ({stores.length})
            </h2>
            <Link to="/vendor/new" className="text-xs font-display font-bold text-nuit hover:underline">
              + Acheter une boutique supplémentaire ({pricing ? `$${pricing.storeCreationFeeUsd}` : ''})
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs font-mono text-encre/50">
              Chargement de vos boutiques…
            </div>
          ) : stores.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className={`bg-white border rounded-card p-6 shadow-xs transition ${
                    store.id === primaryStoreId
                      ? 'border-safran ring-1 ring-safran/35'
                      : 'border-encre/10 hover:border-safran/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-nuit">
                          {store.storeName}
                        </h3>
                        {store.isCertified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-seve/10 text-seve border border-seve/30">
                            <BadgeCheck className="w-3 h-3" />
                            <span>Vendeur Certifié</span>
                          </span>
                        )}
                        {store.hasMonthlyAd && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-safran/20 text-nuit border border-safran/40">
                            <Megaphone className="w-3 h-3 text-safran" />
                            <span>Pub Mensuelle</span>
                          </span>
                        )}
                        {store.payoutBlocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-wax/10 text-wax border border-wax/30">
                            <Lock className="w-3 h-3" />
                            <span>Retraits gelés</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-encre/50 mt-0.5 font-mono">
                        /{store.slug} · Commission {store.commissionRate ?? pricing?.defaultCommissionPercent ?? 5}%
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-encre/50 block">Solde boutique</span>
                      <span className="font-display text-sm font-bold text-nuit tabular-nums">
                        ${(store.balanceUsd ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-encre/70 line-clamp-2 leading-relaxed">
                    {store.description || 'Commerce grossiste et détail sur la place de marché ZandoGo.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(store.enabledServices?.length ? store.enabledServices : ['PHYSICAL']).map((svc) => (
                      <span
                        key={svc}
                        className="px-2 py-0.5 rounded bg-brume border border-encre/10 text-[10px] font-mono font-semibold text-nuit"
                      >
                        {svc === 'PHYSICAL' ? 'Biens Physiques' : svc === 'DIGITAL' ? 'Livres PDF' : 'Services / Km'}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-encre/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/vendor/${store.id}/products`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Produits</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/products/new`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold text-xs transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Publier</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/orders`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-nuit hover:bg-nuit/90 text-brume font-display font-bold text-xs transition shadow-xs"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-safran" />
                        <span>Commandes</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/negotiations`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border border-encre/15 hover:border-safran/60 text-encre font-medium text-xs bg-brume/30 transition"
                      >
                        <Handshake className="w-3.5 h-3.5 text-encre/50" />
                        <span>Devis B2B</span>
                      </Link>
                    </div>

                    <Link
                      to="/products"
                      target="_blank"
                      className="text-encre/40 hover:text-encre"
                      title="Voir sur le site public"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-encre/20 py-16 text-center bg-white p-8">
              <Store className="w-12 h-12 text-encre/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-nuit font-display">Aucune boutique active</h3>
              <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
                Achetez votre première boutique pour commencer à publier vos produits physiques, digitaux ou services.
              </p>
              <Link
                to="/vendor/new"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-safran text-nuit font-display font-bold text-xs hover:bg-safran/90"
              >
                <Plus className="w-4 h-4" />
                <span>Acheter ma première boutique</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
