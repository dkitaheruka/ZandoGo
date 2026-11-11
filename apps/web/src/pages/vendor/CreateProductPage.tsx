import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { ProductType } from '../../lib/types';

interface Category {
  id: string;
  name: string;
}

export function CreateProductPage() {
  const { storeId = 'store-1' } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [productType, setProductType] = useState<ProductType>('PHYSICAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePriceUsd, setBasePriceUsd] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [digitalFileName, setDigitalFileName] = useState('');
  const [digitalFileSize, setDigitalFileSize] = useState('15 Mo');
  const [serviceDuration, setServiceDuration] = useState('');
  const [fulfillmentDetails, setFulfillmentDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(({ data }) => {
      setCategories(data || []);
      if (data && data[0]) setCategoryId(data[0].id);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const slug =
        title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') +
        '-' +
        Math.random().toString(36).slice(2, 6);

      await api.post(`/vendors/stores/${storeId}/products`, {
        title,
        slug,
        description,
        categoryId,
        productType,
        basePriceUsd: Number(basePriceUsd),
        stockQty: productType === 'PHYSICAL' ? Number(stockQty) : 9999,
        lowStockThreshold: Number(lowStockThreshold),
        digitalFileName: productType === 'DIGITAL' ? digitalFileName : undefined,
        digitalFileSize: productType === 'DIGITAL' ? digitalFileSize : undefined,
        serviceDuration: productType === 'SERVICE' ? serviceDuration : undefined,
        fulfillmentDetails: productType === 'SERVICE' ? fulfillmentDetails : undefined,
      });

      navigate(`/vendor/${storeId}/products`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Impossible de créer l’offre.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <VendorLayout storeId={storeId}>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            to={`/vendor/${storeId}/products`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Revenir au catalogue de la boutique</span>
          </Link>
        </div>

        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Créer une Nouvelle Offre ZandoGo
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Prise en charge universelle : biens physiques avec stock unitaire, documents PDF dématérialisés, ou prestations de services en RDC.
          </p>
        </div>

        {/* Offering Type Selector */}
        <div className="p-1.5 bg-slate-200/70 rounded-2xl flex flex-wrap gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setProductType('PHYSICAL')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
              productType === 'PHYSICAL'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Bien Physique (Stock)</span>
          </button>
          <button
            type="button"
            onClick={() => setProductType('DIGITAL')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
              productType === 'DIGITAL'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Document PDF (Téléchargement)</span>
          </button>
          <button
            type="button"
            onClick={() => setProductType('SERVICE')}
            className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
              productType === 'SERVICE'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>Prestation de Service</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Titre commercial de l’offre *
            </label>
            <input
              required
              minLength={3}
              placeholder="ex: Pagne Super Wax Vlisco Original (6 yards)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Catégorie *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Prix unitaire de base ($ USD) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.5"
                placeholder="ex: 65.00"
                value={basePriceUsd}
                onChange={(e) => setBasePriceUsd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Contextual Fields: Physical Inventory */}
          {productType === 'PHYSICAL' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Paramètres d’Inventaire & Stock
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantité initiale en rayon (unités) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Seuil d’alerte stock critique
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contextual Fields: Digital PDF */}
          {productType === 'DIGITAL' && (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-4">
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Fichier Numérique Téléchargeable
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-indigo-900 mb-1">
                    Nom du fichier PDF *
                  </label>
                  <input
                    type="text"
                    placeholder="guide-investissement-rdc-2026.pdf"
                    value={digitalFileName}
                    onChange={(e) => setDigitalFileName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-900 mb-1">
                    Taille indicative (Mo)
                  </label>
                  <input
                    type="text"
                    value={digitalFileSize}
                    onChange={(e) => setDigitalFileSize(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contextual Fields: Service */}
          {productType === 'SERVICE' && (
            <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-4">
              <h3 className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                Conditions de Prestation de Service
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sky-900 mb-1">
                    Durée ou délai d’intervention
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Forfait mensuel 30j ou intervention sous 2h"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-900 mb-1">
                    Modalités de prise de contact
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Appel technicien sous 2h pour RDV"
                    value={fulfillmentDetails}
                    onChange={(e) => setFulfillmentDetails(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Description détaillée de l'offre
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails techniques, composition, garanties, conditions de livraison en RDC..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 text-xs transition shadow-xs disabled:opacity-50"
          >
            {loading ? 'Publication en cours…' : 'Publier l’offre sur la place de marché ZandoGo'}
          </button>
        </form>
      </div>
    </VendorLayout>
  );
}
