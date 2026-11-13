import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  Truck,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { PlatformPricing, VendorStore } from '../../lib/types';

export function CreateStorePage() {
  const navigate = useNavigate();
  const { exchangeRate } = useStore();
  const [pricing, setPricing] = useState<PlatformPricing | null>(null);
  const [existingStores, setExistingStores] = useState<VendorStore[]>([]);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [storeType, setStoreType] = useState<'RETAIL' | 'DIGITAL' | 'SERVICES' | 'LOGISTICS'>('RETAIL');
  const [fulfillmentMode, setFulfillmentMode] = useState<
    'PLATFORM_DELIVERY' | 'SELF_SHIP' | 'DIRECT_DOWNLOAD' | 'SERVICE_APPOINTMENT'
  >('PLATFORM_DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY' | 'CARD'>('MPESA');
  const [customerPhone, setCustomerPhone] = useState('+243810002233');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<VendorStore>('/vendors/stores', {
        storeName,
        slug,
        description,
        storeType,
        fulfillmentMode,
        paymentMethod,
        customerPhone,
      });
      navigate(`/vendor/${data.id}/products`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de finaliser l’achat de la boutique.');
    } finally {
      setLoading(false);
    }
  }

  const feeUsd = pricing?.storeCreationFeeUsd;
  const feeCdf = feeUsd !== undefined ? Math.round(feeUsd * exchangeRate) : null;

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
            Vous pouvez posséder une ou plusieurs boutiques dédiées (mode, électronique, PDF, logistique) pour y publier vos produits séparément.
          </p>
        </div>

        {/* Dynamic Store Purchase Pricing Banner */}
        <div className="rounded-card bg-nuit text-brume p-5 border border-safran/35 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-safran font-semibold">
              <Store className="w-3.5 h-3.5" />
              <span>Licence d’ouverture de boutique (Tarif Admin)</span>
            </span>
            <p className="text-xs text-brume/80">
              Paiement unique d’ouverture via MaishaPay RDC + reçu SMS Africa’s Talking. Commission par vente :{' '}
              <strong className="text-safran">{pricing ? `${pricing.defaultCommissionPercent}%` : '…'}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="font-display text-2xl font-extrabold text-safran tabular-nums block">
              {feeUsd !== undefined ? `$${feeUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}` : 'Chargement…'}
            </span>
            {feeCdf !== null && (
              <span className="text-[11px] font-mono text-brume/60 tabular-nums">
                ≈ {feeCdf.toLocaleString('fr-FR')} CDF
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-encre/10 rounded-card p-6 shadow-xs space-y-6">
          {/* Business Type Selection */}
          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-2">
              Typologie de votre activité commerciale *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  type: 'RETAIL' as const,
                  label: 'Commerce & Vente de Gros',
                  desc: 'Gestion de stock, variantes, expédition colis',
                  icon: Package,
                },
                {
                  type: 'DIGITAL' as const,
                  label: 'Documents & Fichiers PDF',
                  desc: 'Téléchargement direct et instantané',
                  icon: FileText,
                },
                {
                  type: 'SERVICES' as const,
                  label: 'Services & Télécoms',
                  desc: 'Fibre, forfaits, assistance technique',
                  icon: Sparkles,
                },
                {
                  type: 'LOGISTICS' as const,
                  label: 'Logistique & Transport',
                  desc: 'Flotte de coursiers ou camions fret',
                  icon: Truck,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = storeType === item.type;
                return (
                  <label
                    key={item.type}
                    className={`p-3.5 rounded-card border cursor-pointer transition flex items-start gap-3 ${
                      isSelected
                        ? 'border-safran bg-safran/15 shadow-xs'
                        : 'border-encre/10 bg-white hover:border-safran/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="storeType"
                      checked={isSelected}
                      onChange={() => {
                        setStoreType(item.type);
                        if (item.type === 'DIGITAL') setFulfillmentMode('DIRECT_DOWNLOAD');
                        else if (item.type === 'SERVICES') setFulfillmentMode('SERVICE_APPOINTMENT');
                        else setFulfillmentMode('PLATFORM_DELIVERY');
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected ? 'bg-safran text-nuit' : 'bg-brume text-encre/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-nuit">{item.label}</p>
                      <p className="text-[11px] text-encre/60 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
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
              placeholder="Présentez votre entreprise, vos stocks et vos conditions de livraison en RDC..."
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
              <option value="DIRECT_DOWNLOAD">Téléchargement numérique direct et instantané</option>
              <option value="SERVICE_APPOINTMENT">Prise de contact & rendez-vous technicien</option>
            </select>
          </div>

          {/* MaishaPay Settlement for Store Purchase */}
          <div className="p-4 rounded-card bg-brume/70 border border-encre/10 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold text-nuit flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-safran" />
                <span>Règlement de la boutique via MaishaPay RDC</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-seve">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Activation instantanée</span>
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-encre/70 mb-1">Moyen de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 text-nuit outline-none focus:border-safran"
                >
                  <option value="MPESA">M-Pesa Vodacom (+243)</option>
                  <option value="ORANGE_MONEY">Orange Money RDC</option>
                  <option value="AIRTEL_MONEY">Airtel Money RDC</option>
                  <option value="CARD">Carte Visa / Mastercard</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-encre/70 mb-1">Téléphone Mobile Money (pour SMS & validation)</label>
                <input
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+243810002233"
                  className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 font-mono text-nuit outline-none focus:border-safran"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-wax font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || feeUsd === undefined}
            className="w-full rounded-card bg-safran hover:bg-safran/90 text-nuit font-display font-bold py-3.5 text-xs transition shadow-xs disabled:opacity-50"
          >
            {loading
              ? 'Paiement MaishaPay & Activation…'
              : feeUsd !== undefined
              ? `Acheter & activer ma boutique (${feeUsd > 0 ? `$${feeUsd}` : 'Gratuit'})`
              : 'Chargement du tarif…'}
          </button>
        </form>
      </div>
    </VendorLayout>
  );
}
