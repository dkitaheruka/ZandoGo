import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  Truck,
  ArrowLeft,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';

export function CreateStorePage() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [storeType, setStoreType] = useState<'RETAIL' | 'DIGITAL' | 'SERVICES' | 'LOGISTICS'>('RETAIL');
  const [fulfillmentMode, setFulfillmentMode] = useState<
    'PLATFORM_DELIVERY' | 'SELF_SHIP' | 'DIRECT_DOWNLOAD' | 'SERVICE_APPOINTMENT'
  >('PLATFORM_DELIVERY');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await api.post('/vendors/stores', {
        storeName,
        slug,
        description,
        storeType,
        fulfillmentMode,
      });
      navigate('/vendor');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de créer la boutique.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <VendorLayout storeName="Création Boutique">
      <div className="max-w-2xl space-y-6">
        <div>
          <Link
            to="/vendor"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Revenir à mes boutiques</span>
          </Link>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Créer un Espace Entreprise sur ZandoGo
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Activez votre boutique pour vendre des biens matériels, des fichiers PDF, des services télécoms ou du transport dans toute la RDC.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {/* Business Type Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
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
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
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
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nom commercial de l’espace *
            </label>
            <input
              required
              minLength={2}
              placeholder="ex: Congo Textile & Distribution"
              value={storeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Identifiant d’accès (slug boutique) *
            </label>
            <div className="flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
              <span className="text-slate-400 font-mono text-xs">zandogo.cd/</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="flex-1 outline-none ml-1 font-mono text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Présentation & Conditions de vente
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Présentez votre entreprise, vos stocks et vos conditions de livraison en RDC..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Mode de distribution par défaut
            </label>
            <select
              value={fulfillmentMode}
              onChange={(e) => setFulfillmentMode(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
            >
              <option value="PLATFORM_DELIVERY">Expédition par les transporteurs agréés ZandoGo</option>
              <option value="SELF_SHIP">Expédition directe par la flotte propre du vendeur</option>
              <option value="DIRECT_DOWNLOAD">Téléchargement numérique direct et instantané</option>
              <option value="SERVICE_APPOINTMENT">Prise de contact & rendez-vous technicien</option>
            </select>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 text-xs transition shadow-xs disabled:opacity-50"
          >
            {loading ? 'Création en cours…' : 'Enregistrer mon espace marchand'}
          </button>
        </form>
      </div>
    </VendorLayout>
  );
}
