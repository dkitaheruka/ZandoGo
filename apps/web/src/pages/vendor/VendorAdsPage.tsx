import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart2, Check, Megaphone, MousePointerClick, Eye } from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { AdCampaignItem, Product, VendorStore } from '../../lib/types';

type AdTypeOption = 'SPONSORED_PRODUCT' | 'STORE_BANNER' | 'CATEGORY_TOP';
type CostModelOption = 'CPC' | 'CPM' | 'FIXED_DAILY';

export function VendorAdsPage() {
  const { storeId = 'store-1' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<AdTypeOption>('SPONSORED_PRODUCT');
  const [productId, setProductId] = useState('');
  const [costModel, setCostModel] = useState<CostModelOption>('CPC');
  const [budgetAmount, setBudgetAmount] = useState('15');
  const [days, setDays] = useState('7');
  const [payMethod, setPayMethod] = useState<'MOBILE_MONEY_MPESA' | 'MOBILE_MONEY_AIRTEL' | 'MOBILE_MONEY_ORANGE' | 'CARD_STRIPE'>('MOBILE_MONEY_MPESA');
  const [phoneNumber, setPhoneNumber] = useState('+243810000001');

  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<{ id: string; impressions: number; clicks: number; ctr: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`).catch(() => ({ data: null })),
      api.get<Product[]>(`/vendors/stores/${storeId}/products`).catch(() => ({ data: [] })),
      api.get<AdCampaignItem[]>('/ads/campaigns/mine').catch(() => ({ data: [] })),
    ])
      .then(([storeRes, prodRes, campRes]) => {
        if (storeRes.data) setStore(storeRes.data);
        const list = Array.isArray(prodRes.data) ? prodRes.data : [];
        setProducts(list);
        if (list[0] && !productId) setProductId(list[0].id);
        setCampaigns(Array.isArray(campRes.data) ? campRes.data : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [storeId]);

  async function handleCreateCampaign(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + Math.max(1, Number(days) || 7) * 24 * 60 * 60 * 1000);
      await api.post('/ads/campaigns', {
        productId: type === 'SPONSORED_PRODUCT' && productId ? productId : undefined,
        type,
        costModel,
        budgetAmount: Number(budgetAmount) || 10,
        currency: 'USD',
        startAt: now.toISOString(),
        endAt: end.toISOString(),
      });
      setNotice('Campagne brouillon créée. Cliquez sur « Activer & Payer » pour lancer la diffusion.');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible de créer cette campagne.');
    } finally {
      setCreating(false);
    }
  }

  async function handlePayCampaign(campaignId: string) {
    setPayingId(campaignId);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post(`/ads/campaigns/${campaignId}/pay`, {
        methodCode: payMethod,
        phoneNumber: payMethod === 'CARD_STRIPE' ? undefined : phoneNumber,
      });
      setNotice(
        data?.status === 'ACTIVE'
          ? `Campagne activée et mise en avant immédiatement (Réf: ${data.paymentRef || 'OK'}).`
          : `Paiement initié (Réf: ${data?.paymentRef || 'OK'}). Suivez les instructions sur votre téléphone.`,
      );
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Échec du paiement de la campagne.');
    } finally {
      setPayingId(null);
    }
  }

  async function handleViewStats(campaignId: string) {
    try {
      const { data } = await api.get<{ impressions: number; clicks: number; ctr: number }>(
        `/ads/campaigns/${campaignId}/stats`,
      );
      setSelectedStats({
        id: campaignId,
        impressions: data.impressions ?? 0,
        clicks: data.clicks ?? 0,
        ctr: data.ctr ?? 0,
      });
    } catch {
      setError('Impossible de charger les statistiques ROI.');
    }
  }

  return (
    <VendorLayout storeId={storeId} storeName={store?.storeName || 'Boutique'}>
      <div className="max-w-6xl space-y-6">
        <div className="border-b border-encre/10 pb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
            <Megaphone className="w-4 h-4 text-seve" />
            <span>Régie Publicitaire ZandoGo Ads</span>
          </div>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
            Boosts Produits, Bannières &amp; Statistiques ROI
          </h1>
          <p className="mt-1 text-xs text-encre/70">
            Sponsorisez vos offres en tête du catalogue RDC (CPC $0.05/clic, CPM $2/1000 vues) et suivez vos performances.
          </p>
        </div>

        <form
          onSubmit={handleCreateCampaign}
          className="rounded-card border border-encre/10 bg-white p-5 shadow-xs space-y-4"
        >
          <h2 className="font-display font-bold text-sm text-nuit">Lancer une nouvelle campagne sponsorisée</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-encre/70 mb-1">Format d’annonce</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AdTypeOption)}
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-xs bg-white"
              >
                <option value="SPONSORED_PRODUCT">Produit Sponsorisé</option>
                <option value="STORE_BANNER">Bannière Boutique</option>
                <option value="CATEGORY_TOP">Tête de Catégorie</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-encre/70 mb-1">Produit ciblé</label>
              <select
                value={productId}
                disabled={type !== 'SPONSORED_PRODUCT'}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-xs bg-white disabled:opacity-50"
              >
                {products.length === 0 && <option value="">Aucun produit actif</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-encre/70 mb-1">Modèle tarifaire</label>
              <select
                value={costModel}
                onChange={(e) => setCostModel(e.target.value as CostModelOption)}
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-xs bg-white"
              >
                <option value="CPC">CPC ($0.05 / clic)</option>
                <option value="CPM">CPM ($2.00 / 1000 vues)</option>
                <option value="FIXED_DAILY">Forfait durée fixe</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-encre/70 mb-1">Budget (USD)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-encre/70 mb-1">Durée (jours)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-encre/10">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-encre/70 font-medium">Moyen de règlement :</span>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="MOBILE_MONEY_MPESA">M-Pesa Vodacom</option>
                <option value="MOBILE_MONEY_AIRTEL">Airtel Money</option>
                <option value="MOBILE_MONEY_ORANGE">Orange Money</option>
                <option value="CARD_STRIPE">Carte Visa / Mastercard</option>
              </select>
              {payMethod !== 'CARD_STRIPE' && (
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+2438..."
                  className="rounded-card border border-encre/20 px-2.5 py-1.5 text-xs font-mono w-36"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 rounded-card bg-nuit hover:bg-nuit/90 text-brume font-display font-bold text-xs transition disabled:opacity-50"
            >
              {creating ? 'Création…' : 'Créer la campagne'}
            </button>
          </div>
        </form>

        {notice && (
          <div className="rounded-card bg-seve/10 border border-seve/25 px-4 py-3 text-xs text-seve flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/25 px-4 py-3 text-xs text-wax">
            {error}
          </div>
        )}

        {selectedStats && (
          <div className="rounded-card border border-seve/30 bg-seve/5 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 font-display font-bold text-nuit">
              <BarChart2 className="w-4 h-4 text-seve" />
              <span>Performance campagne {selectedStats.id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-6 font-mono">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-encre/60" />
                {selectedStats.impressions} vues
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-seve" />
                {selectedStats.clicks} clics
              </span>
              <span className="font-bold text-seve">CTR {selectedStats.ctr.toFixed(2)}%</span>
            </div>
          </div>
        )}

        <div className="rounded-card border border-encre/10 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-brume/50 border-b border-encre/10 font-display font-bold text-xs text-nuit">
            Mes campagnes publicitaires ({campaigns.length})
          </div>
          {loading ? (
            <div className="p-8 text-center text-xs text-encre/50 font-mono">Chargement des campagnes…</div>
          ) : campaigns.length === 0 ? (
            <div className="p-10 text-center text-xs text-encre/60">
              Aucune campagne publicitaire lancée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-encre/10 bg-brume/30 text-encre/70 font-display font-semibold">
                  <tr>
                    <th className="px-4 py-3">Format &amp; Période</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">Vues / Clics</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-encre/5">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-brume/20">
                      <td className="px-4 py-3.5">
                        <p className="font-display font-bold text-nuit">{camp.type}</p>
                        <p className="text-[11px] font-mono text-encre/60">
                          {new Date(camp.startAt).toLocaleDateString('fr-FR')} →{' '}
                          {new Date(camp.endAt).toLocaleDateString('fr-FR')}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-nuit">
                        {Number(camp.budgetAmount).toFixed(2)} {camp.currency}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-encre/75">
                        {camp.impressions ?? 0} vues · {camp.clicks ?? 0} clics
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-card text-[11px] font-semibold ${
                            camp.status === 'ACTIVE'
                              ? 'bg-seve/15 text-seve'
                              : camp.status === 'DRAFT'
                                ? 'bg-safran/20 text-nuit'
                                : 'bg-encre/10 text-encre/70'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        {camp.status === 'DRAFT' && (
                          <button
                            type="button"
                            disabled={payingId === camp.id}
                            onClick={() => handlePayCampaign(camp.id)}
                            className="px-3 py-1.5 rounded-card bg-seve text-white font-display font-bold text-[11px] hover:bg-seve/90 disabled:opacity-50"
                          >
                            {payingId === camp.id ? 'Activation…' : 'Activer & Payer'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleViewStats(camp.id)}
                          className="px-3 py-1.5 rounded-card border border-encre/15 text-nuit font-medium text-[11px] hover:border-seve"
                        >
                          Stats ROI
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
