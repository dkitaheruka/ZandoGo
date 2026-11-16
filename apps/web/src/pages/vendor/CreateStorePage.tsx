import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Store,
  Check,
  Lock,
  Truck,
  Plus,
  Trash2,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import {
  PaymentMethodSelector,
  detectOperatorFromPhone,
  mapStoreMethodToPaymentCode,
  OPERATOR_META,
  type PaymentMethodCodeType,
  type StorePaymentMethodType,
} from '../../components/PaymentOperatorLogos';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { PlatformPricing, StoreServiceModule, TransportDestination, VendorStore } from '../../lib/types';

export function CreateStorePage() {
  const navigate = useNavigate();
  const { exchangeRate } = useStore();
  const [pricing, setPricing] = useState<PlatformPricing | null>(null);
  const [existingStores, setExistingStores] = useState<VendorStore[]>([]);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [enabledServices, setEnabledServices] = useState<StoreServiceModule[]>(['PHYSICAL']);
  const [fulfillmentMode, setFulfillmentMode] = useState<
    'PLATFORM_DELIVERY' | 'SELF_SHIP' | 'DIRECT_DOWNLOAD' | 'SERVICE_APPOINTMENT'
  >('PLATFORM_DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethodType>('MPESA');
  const [customerPhone, setCustomerPhone] = useState('+243810002233');
  const [isTransportAgency, setIsTransportAgency] = useState(false);
  const [transportDestinations, setTransportDestinations] = useState<TransportDestination[]>([
    {
      id: 'dest-1',
      originCity: 'Goma',
      destinationCity: 'Bukavu',
      basePriceUsd: 18,
      pricePerKmUsd: 0.45,
      estimatedDelay: '6h - 12h (Bateau / Route)',
      vehicleMode: 'Camionnette / Fret Express',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedMethodCode: PaymentMethodCodeType = mapStoreMethodToPaymentCode(paymentMethod);
  const detectedPhoneCode = detectOperatorFromPhone(customerPhone);

  function handleMethodSelect(code: PaymentMethodCodeType) {
    const storeCode = OPERATOR_META[code]?.storeCode;
    if (storeCode) setPaymentMethod(storeCode);
  }

  function handlePhoneChange(val: string) {
    setCustomerPhone(val);
    const detected = detectOperatorFromPhone(val);
    if (detected && OPERATOR_META[detected]?.storeCode && paymentMethod !== 'CARD') {
      setPaymentMethod(OPERATOR_META[detected].storeCode!);
    }
  }

  useEffect(() => {
    api
      .get<PlatformPricing>('/platform/pricing')
      .then(({ data }) => {
        if (data) setPricing(data);
      })
      .catch(() => {});

    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setExistingStores(data || []))
      .catch(() => {});
  }, []);

  function handleNameChange(value: string) {
    setStoreName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    );
  }

  function toggleService(svc: StoreServiceModule) {
    setEnabledServices((prev) => {
      const exists = prev.includes(svc);
      if (exists) {
        if (prev.length === 1) return prev; // at least one service must stay selected
        const next = prev.filter((s) => s !== svc);
        if (next.length === 1 && next[0] === 'DIGITAL') setFulfillmentMode('DIRECT_DOWNLOAD');
        else if (next.length === 1 && next[0] === 'SERVICE') setFulfillmentMode('SERVICE_APPOINTMENT');
        else setFulfillmentMode('PLATFORM_DELIVERY');
        return next;
      }
      const next = [...prev, svc];
      if (next.length === 1 && next[0] === 'DIGITAL') setFulfillmentMode('DIRECT_DOWNLOAD');
      else if (next.length === 1 && next[0] === 'SERVICE') setFulfillmentMode('SERVICE_APPOINTMENT');
      else setFulfillmentMode('PLATFORM_DELIVERY');
      return next;
    });
  }

  function getModulePrice(svc: StoreServiceModule): number {
    if (!pricing) return 0;
    if (svc === 'DIGITAL') return Number(pricing.serviceDigitalFeeUsd ?? 0);
    if (svc === 'SERVICE') return Number(pricing.servicePrestationFeeUsd ?? 0);
    return Number(pricing.servicePhysicalFeeUsd ?? 0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enabledServices.length === 0) {
      setError('Sélectionnez au moins un service payant pour votre boutique.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const derivedStoreType = isTransportAgency
        ? 'LOGISTICS'
        : enabledServices.length === 1 && enabledServices[0] === 'DIGITAL'
        ? 'DIGITAL'
        : enabledServices.length === 1 && enabledServices[0] === 'SERVICE'
        ? 'SERVICES'
        : 'RETAIL';

      const cleanDestinations = isTransportAgency
        ? transportDestinations.filter((d) => d.originCity.trim() && d.destinationCity.trim())
        : [];

      const { data } = await api.post<VendorStore>('/vendors/stores', {
        storeName,
        slug,
        description,
        storeType: derivedStoreType,
        enabledServices,
        fulfillmentMode,
        paymentMethod,
        customerPhone,
        isTransportAgency,
        transportDestinations: cleanDestinations,
      });
      navigate(`/vendor/${data.id}/products`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de finaliser l’achat de la boutique.');
    } finally {
      setLoading(false);
    }
  }

  const baseFeeUsd = pricing?.storeCreationFeeUsd;
  const modulesFeeUsd = enabledServices.reduce((sum, svc) => sum + getModulePrice(svc), 0);
  const totalFeeUsd = baseFeeUsd !== undefined ? Number((baseFeeUsd + modulesFeeUsd).toFixed(2)) : undefined;
  const totalFeeCdf = totalFeeUsd !== undefined ? Math.round(totalFeeUsd * exchangeRate) : null;

  const SERVICE_MODULES: {
    key: StoreServiceModule;
    label: string;
    desc: string;
    priceUsd: number;
    icon: typeof Package;
  }[] = [
    {
      key: 'PHYSICAL',
      label: 'Biens Physiques',
      desc: 'Habits, électronique, alimentation · Gestion stock, tailles & couleurs personnalisées',
      priceUsd: getModulePrice('PHYSICAL'),
      icon: Package,
    },
    {
      key: 'DIGITAL',
      label: 'Livres & Documents PDF',
      desc: 'Envoi automatique du lien de téléchargement au client dès paiement (sans intervention)',
      priceUsd: getModulePrice('DIGITAL'),
      icon: FileText,
    },
    {
      key: 'SERVICE',
      label: 'Services & Transport au km',
      desc: 'Fibre, dépannage, coursier & fret facturé au kilomètre ou au forfait',
      priceUsd: getModulePrice('SERVICE'),
      icon: Sparkles,
    },
  ];

  return (
    <VendorLayout storeName="Acheter une Boutique">
      <div className="max-w-2xl space-y-6">
        <div>
          <Link
            to="/vendor"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-encre/60 hover:text-nuit mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Revenir à mes boutiques ({existingStores.length})</span>
          </Link>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
            {existingStores.length > 0
              ? 'Acheter une Nouvelle Boutique ZandoGo'
              : 'Acheter & Activer Votre Première Boutique'}
          </h1>
          <p className="mt-1 text-xs text-encre/70">
            Acheter une boutique ne débloque pas automatiquement tous les services : choisissez les modules souhaités ci-dessous (chacun a son tarif fixé par l’admin). Les autres services pourront être payés et activés plus tard si besoin.
          </p>
        </div>

        {/* Dynamic Store Purchase Pricing Banner */}
        <div className="rounded-card bg-nuit text-brume p-5 border border-safran/35 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-safran font-semibold">
              <Store className="w-3.5 h-3.5" />
              <span>Licence boutique + Modules choisis (Tarifs Admin)</span>
            </span>
            <p className="text-xs text-brume/80">
              Ouverture : <strong className="text-white">${baseFeeUsd ?? '…'}</strong> + {enabledServices.length} module(s) :{' '}
              <strong className="text-safran">${modulesFeeUsd.toFixed(2)}</strong> · Commission :{' '}
              <strong className="text-safran">{pricing ? `${pricing.defaultCommissionPercent}%` : '…'}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="font-display text-2xl font-extrabold text-safran tabular-nums block">
              {totalFeeUsd !== undefined
                ? `$${totalFeeUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`
                : 'Chargement…'}
            </span>
            {totalFeeCdf !== null && (
              <span className="text-[11px] font-mono text-brume/60 tabular-nums">
                ≈ {totalFeeCdf.toLocaleString('fr-FR')} CDF
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-encre/10 rounded-card p-6 shadow-xs space-y-6">
          {/* Multi-select Paid Service Modules */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70">
                Services à activer sur cette boutique * (au choix)
              </label>
              <span className="text-[11px] text-seve font-semibold">
                {enabledServices.length}/3 service(s) sélectionné(s)
              </span>
            </div>
            <div className="space-y-2.5">
              {SERVICE_MODULES.map((item) => {
                const Icon = item.icon;
                const isSelected = enabledServices.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleService(item.key)}
                    className={`w-full text-left p-4 rounded-card border transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-safran bg-safran/15 shadow-xs'
                        : 'border-encre/15 bg-white hover:border-safran/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? 'bg-safran text-nuit' : 'bg-brume text-encre/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-nuit">{item.label}</p>
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seve text-brume text-[10px] font-display font-bold">
                              <Check className="w-3 h-3" />
                              <span>Sélectionné</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-encre/5 text-encre/55 text-[10px] font-mono">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Activé plus tard si besoin</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-encre/65 mt-1">{item.desc}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-display text-sm font-extrabold text-nuit tabular-nums block">
                        {pricing ? `+$${item.priceUsd.toFixed(2)}` : '…'}
                      </span>
                      <span className="text-[10px] font-mono text-encre/50">
                        {pricing ? `≈ ${Math.round(item.priceUsd * exchangeRate).toLocaleString('fr-FR')} CDF` : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Nom commercial de la boutique *
            </label>
            <input
              required
              minLength={2}
              placeholder="ex: Congo Textile & Distribution"
              value={storeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-safran"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Identifiant d’accès (slug boutique) *
            </label>
            <div className="flex items-center rounded-card border border-encre/20 bg-brume/30 px-4 py-2 text-xs focus-within:border-safran">
              <span className="text-encre/50 font-mono text-xs">zandogo.cd/</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="flex-1 outline-none ml-1 font-mono text-xs text-encre bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Présentation & Conditions de vente
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Présentez votre entreprise basée à Goma (Nord-Kivu), vos stocks et vos conditions de livraison en RDC..."
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2 text-xs text-encre outline-none focus:border-safran resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Mode de distribution par défaut
            </label>
            <select
              value={fulfillmentMode}
              onChange={(e) => setFulfillmentMode(e.target.value as any)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs font-semibold text-encre outline-none focus:border-safran"
            >
              <option value="PLATFORM_DELIVERY">Expédition par les transporteurs agréés ZandoGo</option>
              <option value="SELF_SHIP">Expédition directe par la flotte propre du vendeur</option>
              <option value="DIRECT_DOWNLOAD">Envoi automatique des liens PDF (sans intervention vendeur)</option>
              <option value="SERVICE_APPOINTMENT">Prise de contact & rendez-vous technicien</option>
            </select>
          </div>

          {/* Transport Agency Destinations Builder */}
          <div className="p-4 rounded-card bg-brume/60 border border-seve/25 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isTransportAgency}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsTransportAgency(checked);
                  if (checked && !enabledServices.includes('SERVICE')) {
                    setEnabledServices((prev) => [...prev, 'SERVICE']);
                  }
                }}
                className="mt-0.5 accent-seve h-4 w-4"
              />
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-nuit">
                  <Truck className="w-4 h-4 text-seve" />
                  <span>Cette boutique est une Agence de Transport / Fret (RDC & environs)</span>
                </span>
                <p className="text-[11px] text-encre/65 mt-0.5">
                  Cochez pour spécifier vos différentes lignes et destinations desservies à travers toute la RDC et les pays voisins (Goma, Bukavu, Beni, Butembo, Kinshasa, Lubumbashi, Kigali…).
                </p>
              </div>
            </label>

            {isTransportAgency && (
              <div className="space-y-3 pt-2 border-t border-encre/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-display font-bold uppercase tracking-wider text-nuit">
                    Lignes & Destinations desservies ({transportDestinations.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTransportDestinations((prev) => [
                        ...prev,
                        {
                          id: `dest-${Date.now()}`,
                          originCity: 'Goma',
                          destinationCity: '',
                          basePriceUsd: 15,
                          pricePerKmUsd: 0.5,
                          estimatedDelay: '24h',
                          vehicleMode: 'Camion / Cargo',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-card bg-nuit text-brume text-[11px] font-display font-bold"
                  >
                    <Plus className="w-3 h-3 text-safran" />
                    <span>Ajouter une ligne</span>
                  </button>
                </div>

                {transportDestinations.map((dest, idx) => (
                  <div key={dest.id} className="p-3 rounded-card bg-white border border-encre/15 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-nuit">
                      <span>Ligne #{idx + 1}</span>
                      {transportDestinations.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setTransportDestinations((prev) => prev.filter((d) => d.id !== dest.id))
                          }
                          className="text-wax hover:underline inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Retirer</span>
                        </button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Départ (ex: Goma)"
                        value={dest.originCity}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, originCity: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Destination (ex: Kinshasa, Lubumbashi)"
                        value={dest.destinationCity}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, destinationCity: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Mode (ex: Cargo, Camion, Bateau)"
                        value={dest.vehicleMode}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, vehicleMode: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="number"
                        min={1}
                        step="0.5"
                        placeholder="Tarif base ($ USD)"
                        value={dest.basePriceUsd}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) =>
                              d.id === dest.id ? { ...d, basePriceUsd: Number(e.target.value) } : d,
                            ),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs font-bold outline-none focus:border-seve"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.05"
                        placeholder="Prix / km ($)"
                        value={dest.pricePerKmUsd ?? ''}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) =>
                              d.id === dest.id ? { ...d, pricePerKmUsd: Number(e.target.value) } : d,
                            ),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        placeholder="Délai (ex: 24h - 48h)"
                        value={dest.estimatedDelay}
                        onChange={(e) =>
                          setTransportDestinations((prev) =>
                            prev.map((d) => (d.id === dest.id ? { ...d, estimatedDelay: e.target.value } : d)),
                          )
                        }
                        className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operator Settlement for Store Purchase */}
          <div className="p-4 rounded-card bg-brume/70 border border-encre/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-display font-bold text-nuit flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-safran" />
                <span>Règlement sécurisé de la boutique + services</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-seve">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Activation instantanée</span>
              </span>
            </div>

            <PaymentMethodSelector
              value={selectedMethodCode}
              onChange={handleMethodSelect}
              autoDetectedCode={detectedPhoneCode}
              columns={2}
            />

            {paymentMethod !== 'CARD' && (
              <div className="text-xs">
                <label className="block font-semibold text-encre/70 mb-1">
                  Numéro {OPERATOR_META[selectedMethodCode].label} (Goma / RDC · pour SMS & validation)
                </label>
                <input
                  required
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+243810002233 ou +24397... ou +24389..."
                  className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 font-mono text-nuit outline-none focus:border-safran"
                />
                {detectedPhoneCode && (
                  <p className="mt-1 text-[11px] text-seve font-medium">
                    Réseau détecté automatiquement : {OPERATOR_META[detectedPhoneCode].label}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-wax font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || totalFeeUsd === undefined}
            className="w-full rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold py-3.5 text-xs transition shadow-xs disabled:opacity-50"
          >
            {loading
              ? 'Paiement & Activation en cours…'
              : totalFeeUsd !== undefined
              ? `Acheter la boutique + ${enabledServices.length} module(s) ($${totalFeeUsd.toFixed(2)})`
              : 'Chargement du tarif…'}
          </button>
        </form>
      </div>
    </VendorLayout>
  );
}
