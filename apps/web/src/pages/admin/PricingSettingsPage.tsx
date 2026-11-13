import { FormEvent, useEffect, useState } from 'react';
import { SlidersHorizontal, CheckCircle2, Store, BadgeCheck, Megaphone, Percent } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { PlatformPricing } from '../../lib/types';

export function PricingSettingsPage() {
  const { exchangeRate } = useStore();
  const [form, setForm] = useState<PlatformPricing>({
    storeCreationFeeUsd: 25,
    certificationMonthlyFeeUsd: 15,
    certificationQuarterlyFeeUsd: 39,
    adEssentialMonthlyFeeUsd: 29,
    adProCarouselMonthlyFeeUsd: 59,
    defaultCommissionPercent: 5,
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
        certificationMonthlyFeeUsd: Number(form.certificationMonthlyFeeUsd),
        certificationQuarterlyFeeUsd: Number(form.certificationQuarterlyFeeUsd),
        adEssentialMonthlyFeeUsd: Number(form.adEssentialMonthlyFeeUsd),
        adProCarouselMonthlyFeeUsd: Number(form.adProCarouselMonthlyFeeUsd),
        defaultCommissionPercent: Number(form.defaultCommissionPercent),
      });
      if (data) setForm(data);
      setSuccess(
        'Grille tarifaire enregistrée. Tous les espaces vendeurs (achat de boutique, certification, publicité et commissions) utilisent désormais ces montants en temps réel.',
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
                    Facturé via MaishaPay à chaque création de boutique · ≈ {formatCdf(form.storeCreationFeeUsd)}
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
