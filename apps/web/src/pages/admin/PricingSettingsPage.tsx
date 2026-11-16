import { FormEvent, useEffect, useState } from 'react';
import { SlidersHorizontal, CheckCircle2, Store, BadgeCheck, Megaphone, Percent, Zap, CreditCard } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { PlatformPricing } from '../../lib/types';

export function PricingSettingsPage() {
  const { exchangeRate } = useStore();
  const [form, setForm] = useState<PlatformPricing>({
    storeCreationFeeUsd: 15,
    servicePhysicalFeeUsd: 15,
    serviceDigitalFeeUsd: 10,
    servicePrestationFeeUsd: 20,
    certificationMonthlyFeeUsd: 15,
    certificationQuarterlyFeeUsd: 39,
    adEssentialMonthlyFeeUsd: 29,
    adProCarouselMonthlyFeeUsd: 59,
    defaultCommissionPercent: 5,
    paymentTransactionFeePercent: 3.5,
    allowImmediateVendorWithdrawal: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PlatformPricing>('/platform/pricing')
      .then(({ data }) => {
        if (data) setForm(data);
      })
      .catch(() => setError('Impossible de charger la grille tarifaire plateforme.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.put<PlatformPricing>('/platform/pricing', {
        storeCreationFeeUsd: Number(form.storeCreationFeeUsd),
        servicePhysicalFeeUsd: Number(form.servicePhysicalFeeUsd),
        serviceDigitalFeeUsd: Number(form.serviceDigitalFeeUsd),
        servicePrestationFeeUsd: Number(form.servicePrestationFeeUsd),
        certificationMonthlyFeeUsd: Number(form.certificationMonthlyFeeUsd),
        certificationQuarterlyFeeUsd: Number(form.certificationQuarterlyFeeUsd),
        adEssentialMonthlyFeeUsd: Number(form.adEssentialMonthlyFeeUsd),
        adProCarouselMonthlyFeeUsd: Number(form.adProCarouselMonthlyFeeUsd),
        defaultCommissionPercent: Number(form.defaultCommissionPercent),
        paymentTransactionFeePercent: Number(form.paymentTransactionFeePercent),
        allowImmediateVendorWithdrawal: Boolean(form.allowImmediateVendorWithdrawal),
      });
      if (data) setForm(data);
      setSuccess(
        'Grille tarifaire enregistrée. Tous les frais (achats, transaction client, retraits immédiats, certification et publicité) utilisent désormais ces réglages en temps réel.',
      );
    } catch {
      setError('Impossible d’enregistrer les nouveaux tarifs vendeurs.');
    } finally {
      setSaving(false);
    }
  }

  function formatCdf(usd: number) {
    return `${Math.round((Number(usd) || 0) * exchangeRate).toLocaleString('fr-FR')} CDF`;
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-white/10 pb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configuration Tarifaire Dynamique</span>
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Tarifs Vendeurs, Boutiques & Commissions
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Aucun tarif n’est codé en dur : définissez ici les frais facturés aux vendeurs lors de l’achat d’une boutique, la certification ou la publicité mensuelle.
            </p>
          </div>
          {form.updatedAt && (
            <span className="text-[11px] font-mono text-brume/50">
              Dernière MàJ : {new Date(form.updatedAt).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-card bg-seve/15 border border-seve/35 text-xs text-seve font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="h-64 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Store purchase fee */}
              <div className="p-6 rounded-card bg-nuit/60 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-safran text-xs font-display font-bold uppercase tracking-wider">
                  <Store className="w-4 h-4" />
                  <span>Achat d’espace boutique & Commission</span>
                </div>

                <div>
                  <label htmlFor="storeCreationFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Prix d’achat d’une boutique (USD $)
                  </label>
                  <input
                    id="storeCreationFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.storeCreationFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, storeCreationFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    Facturé par Mobile Money ou Carte à chaque création de boutique · ≈ {formatCdf(form.storeCreationFeeUsd)}
                  </p>
                </div>

                <div>
                  <label htmlFor="defaultCommissionPercent" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Commission plateforme par défaut (%)
                  </label>
                  <div className="relative">
                    <input
                      id="defaultCommissionPercent"
                      type="number"
                      min={0}
                      max={45}
                      step="0.5"
                      required
                      value={form.defaultCommissionPercent}
                      onChange={(e) => setForm((p) => ({ ...p, defaultCommissionPercent: Number(e.target.value) }))}
                      className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                    />
                    <Percent className="w-4 h-4 text-brume/40 absolute right-3.5 top-3" />
                  </div>
                  <p className="mt-1 text-[11px] text-brume/55">
                    Appliquée automatiquement aux nouvelles boutiques (modifiable boutique par boutique dans Modération).
                  </p>
                </div>
              </div>

              {/* Certification pricing */}
              <div className="p-6 rounded-card bg-nuit/60 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-seve text-xs font-display font-bold uppercase tracking-wider">
                  <BadgeCheck className="w-4 h-4" />
                  <span>Abonnement Certification Vendeur</span>
                </div>

                <div>
                  <label htmlFor="certificationMonthlyFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Certification Mensuelle (USD $ / mois)
                  </label>
                  <input
                    id="certificationMonthlyFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.certificationMonthlyFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, certificationMonthlyFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.certificationMonthlyFeeUsd)} · Sceau « Vendeur Certifié » sur les produits
                  </p>
                </div>

                <div>
                  <label htmlFor="certificationQuarterlyFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Certification Trimestrielle (USD $ / 3 mois)
                  </label>
                  <input
                    id="certificationQuarterlyFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.certificationQuarterlyFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, certificationQuarterlyFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.certificationQuarterlyFeeUsd)} / trimestre
                  </p>
                </div>
              </div>
            </div>

            {/* Store Service Modules Pricing (Zero hardcoding) */}
            <div className="p-6 rounded-card bg-nuit/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-safran text-xs font-display font-bold uppercase tracking-wider">
                  <Store className="w-4 h-4" />
                  <span>Tarifs des Modules de Services par Boutique (À la carte)</span>
                </div>
                <span className="text-[11px] font-mono text-brume/60">
                  Payés à l’ouverture ou activés plus tard (Airtel, M-Pesa, Orange, MTN, Visa)
                </span>
              </div>
              <p className="text-xs text-brume/70">
                Lors de l’achat d’une boutique, le vendeur paie l’ouverture de base + uniquement les services choisis. Il peut ensuite payer pour activer les services restants sur sa boutique.
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="servicePhysicalFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Module Bien Physique (USD $)
                  </label>
                  <input
                    id="servicePhysicalFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.servicePhysicalFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, servicePhysicalFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.servicePhysicalFeeUsd)} · Stock, tailles, couleurs
                  </p>
                </div>

                <div>
                  <label htmlFor="serviceDigitalFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Module Livre / Document PDF (USD $)
                  </label>
                  <input
                    id="serviceDigitalFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.serviceDigitalFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, serviceDigitalFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.serviceDigitalFeeUsd)} · Envoi automatique de liens
                  </p>
                </div>

                <div>
                  <label htmlFor="servicePrestationFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Module Service / Transport au km (USD $)
                  </label>
                  <input
                    id="servicePrestationFeeUsd"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={form.servicePrestationFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, servicePrestationFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.servicePrestationFeeUsd)} · Prestations & fret au km
                  </p>
                </div>
              </div>
            </div>

            {/* Advertising pricing */}
            <div className="p-6 rounded-card bg-nuit/60 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-safran text-xs font-display font-bold uppercase tracking-wider">
                <Megaphone className="w-4 h-4" />
                <span>Packs Publicité Mensuelle Vendeur</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="adEssentialMonthlyFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Pack Priorité Catalogue (USD $ / mois)
                  </label>
                  <input
                    id="adEssentialMonthlyFeeUsd"
                    type="number"
                    min={0}
                    step="1"
                    required
                    value={form.adEssentialMonthlyFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, adEssentialMonthlyFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.adEssentialMonthlyFeeUsd)} · Position prioritaire dans les recherches
                  </p>
                </div>

                <div>
                  <label htmlFor="adProCarouselMonthlyFeeUsd" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Pack Vitrine + Carrousel d’Accueil (USD $ / mois)
                  </label>
                  <input
                    id="adProCarouselMonthlyFeeUsd"
                    type="number"
                    min={0}
                    step="1"
                    required
                    value={form.adProCarouselMonthlyFeeUsd}
                    onChange={(e) => setForm((p) => ({ ...p, adProCarouselMonthlyFeeUsd: Number(e.target.value) }))}
                    className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                  />
                  <p className="mt-1 text-[11px] font-mono text-brume/55 tabular-nums">
                    ≈ {formatCdf(form.adProCarouselMonthlyFeeUsd)} · Défilement bannière d’accueil + tête du catalogue
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Fee & Immediate Withdrawal Rules */}
            <div className="p-6 rounded-card bg-nuit/60 border border-safran/30 space-y-5">
              <div className="flex items-center gap-2 text-safran text-xs font-display font-bold uppercase tracking-wider">
                <CreditCard className="w-4 h-4" />
                <span>Frais de Transaction Paiement & Règle de Retrait Vendeur</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div>
                  <label htmlFor="paymentTransactionFeePercent" className="block text-xs font-semibold text-brume/85 mb-1.5">
                    Frais de transaction paiement (Mobile Money / Carte) (%)
                  </label>
                  <div className="relative">
                    <input
                      id="paymentTransactionFeePercent"
                      type="number"
                      min={0}
                      max={20}
                      step="0.1"
                      required
                      value={form.paymentTransactionFeePercent}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, paymentTransactionFeePercent: Number(e.target.value) }))
                      }
                      className="w-full rounded-card bg-white/5 border border-white/15 px-4 py-2.5 font-display text-sm font-bold text-white tabular-nums outline-none focus:border-safran"
                    />
                    <Percent className="w-4 h-4 text-brume/40 absolute right-3.5 top-3" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-brume/60 leading-relaxed">
                    Pourcentage affiché au client avant validation et ajouté exactement au montant débité sur son compte Airtel, M-Pesa, Orange, MTN ou Carte (par défaut 3.5%).
                  </p>
                </div>

                <div className="p-4 rounded-card bg-white/5 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-white">
                      <Zap className="w-4 h-4 text-safran" />
                      <span>Retrait immédiat global (sans délai de 48h)</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.allowImmediateVendorWithdrawal}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          allowImmediateVendorWithdrawal: !p.allowImmediateVendorWithdrawal,
                        }))
                      }
                      className={`px-3 py-1 rounded-full text-[11px] font-display font-bold transition ${
                        form.allowImmediateVendorWithdrawal
                          ? 'bg-seve text-brume'
                          : 'bg-white/10 text-brume/70'
                      }`}
                    >
                      {form.allowImmediateVendorWithdrawal ? 'AUTORISÉ' : 'DÉLAI 48H'}
                    </button>
                  </div>
                  <p className="text-[11px] text-brume/65 leading-relaxed">
                    Par défaut, le compte à rebours de 48h démarre dès le paiement client. Activez cette option pour permettre à tous les vendeurs (hors litige) de retirer immédiatement sans attendre 48h.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-card bg-safran hover:bg-safran/90 text-nuit text-xs font-display font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer la grille tarifaire ZandoGo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
