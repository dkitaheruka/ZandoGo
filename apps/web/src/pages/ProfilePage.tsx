import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Trash2, CheckCircle2, ShieldCheck, Store, Bike, Heart, User as UserIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import type { Address, Product } from '../lib/types';

export function ProfilePage() {
  const { user } = useAuth();
  const { currency, setCurrency, wishlistIds, formatPrimaryPrice } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [commune, setCommune] = useState('Gombe');
  const [quartier, setQuartier] = useState('');
  const [referencePoint, setReferencePoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function loadAddresses() {
    api
      .get<Address[]>('/users/me/addresses')
      .then(({ data }) => setAddresses(data || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadAddresses();
    api
      .get<Product[]>('/products')
      .then(({ data }) => setProducts(data || []))
      .catch(() => {});
  }, []);

  async function handleAddAddress(e: FormEvent) {
    e.preventDefault();
    if (!quartier.trim()) return;
    setSaving(true);
    try {
      await api.post('/users/me/addresses', {
        commune,
        quartier: quartier.trim(),
        referencePoint: referencePoint.trim(),
        latitude: -4.315,
        longitude: 15.308,
        isDefault: addresses.length === 0,
      });
      setQuartier('');
      setReferencePoint('');
      setNotice('Nouvelle adresse enregistrée.');
      loadAddresses();
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    await api.patch(`/users/me/addresses/${id}/default`).catch(() => {});
    loadAddresses();
  }

  async function handleDeleteAddress(id: string) {
    await api.delete(`/users/me/addresses/${id}`).catch(() => {});
    loadAddresses();
  }

  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* Header Profile Card */}
      <div className="rounded-card bg-nuit text-brume p-6 md:p-8 flex flex-wrap items-center justify-between gap-6 border border-white/10">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-card bg-safran text-nuit font-display font-extrabold text-xl flex items-center justify-center shrink-0">
            {(user?.fullName || 'U')[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold">{user?.fullName || 'Client ZandoGo'}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-seve/20 text-seve text-[10px] font-bold border border-seve/30">
                <ShieldCheck className="w-3 h-3" />
                Compte Vérifié
              </span>
            </div>
            <p className="text-xs text-brume/70 font-mono mt-1">
              {user?.email || '—'} · {user?.phone || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-brume/60">Devise préférée :</span>
          <div className="inline-flex rounded-card bg-white/10 p-1 border border-white/15">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 rounded-lg font-display font-bold transition ${
                currency === 'USD' ? 'bg-safran text-nuit' : 'text-brume/75'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('CDF')}
              className={`px-3 py-1 rounded-lg font-display font-bold transition ${
                currency === 'CDF' ? 'bg-safran text-nuit' : 'text-brume/75'
              }`}
            >
              CDF (FC)
            </button>
          </div>
        </div>
      </div>

      {/* Role Portals */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          to="/kyc"
          className="p-5 rounded-card bg-white border border-encre/10 hover:border-seve transition shadow-xs flex items-start gap-3"
        >
          <UserIcon className="w-5 h-5 text-seve shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-sm text-nuit">Documents & KYC</p>
            <p className="text-xs text-encre/60 mt-1">Carte d’électeur, patente RCCM ou permis livreur.</p>
          </div>
        </Link>
        <Link
          to="/vendor"
          className="p-5 rounded-card bg-white border border-encre/10 hover:border-seve transition shadow-xs flex items-start gap-3"
        >
          <Store className="w-5 h-5 text-seve shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-sm text-nuit">Espace Vendeur Pro</p>
            <p className="text-xs text-encre/60 mt-1">Stocks, devis B2B, expéditions et retraits.</p>
          </div>
        </Link>
        <Link
          to="/delivery"
          className="p-5 rounded-card bg-white border border-encre/10 hover:border-seve transition shadow-xs flex items-start gap-3"
        >
          <Bike className="w-5 h-5 text-safran shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-sm text-nuit">Portail Coursier RDC</p>
            <p className="text-xs text-encre/60 mt-1">Gérer vos courses et preuves de remise.</p>
          </div>
        </Link>
      </div>

      {notice && (
        <div className="p-3.5 rounded-card bg-seve/10 border border-seve/30 text-xs text-seve font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Addresses Management */}
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-nuit flex items-center gap-2">
            <MapPin className="w-5 h-5 text-seve" />
            <span>Carnet d’Adresses RDC ({addresses.length})</span>
          </h2>

          {addresses.length === 0 ? (
            <div className="p-6 rounded-card bg-white border border-dashed border-encre/20 text-xs text-encre/60">
              Aucune adresse enregistrée pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-card bg-white border shadow-xs flex items-start justify-between gap-4 ${
                    addr.isDefault ? 'border-seve ring-1 ring-seve/20' : 'border-encre/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-sm text-nuit">
                        {[addr.commune, addr.quartier].filter(Boolean).join(' — ')}
                      </p>
                      {addr.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-seve/10 text-seve text-[10px] font-bold">
                          Par défaut
                        </span>
                      )}
                    </div>
                    {addr.referencePoint && (
                      <p className="text-xs text-encre/65 mt-1">Repère : {addr.referencePoint}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-seve hover:underline font-medium"
                      >
                        Définir par défaut
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="p-1.5 text-encre/40 hover:text-wax rounded-lg"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleAddAddress} className="p-5 rounded-card bg-white border border-encre/10 shadow-xs space-y-4">
          <h3 className="font-display font-bold text-sm text-nuit">Ajouter une adresse de livraison</h3>

          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1">Commune / Ville</label>
            <select
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2 text-xs text-nuit outline-none focus:border-seve"
            >
              <option value="Gombe">Kinshasa — Gombe</option>
              <option value="Ngaliema">Kinshasa — Ngaliema</option>
              <option value="Limete">Kinshasa — Limete</option>
              <option value="Lingwala">Kinshasa — Lingwala</option>
              <option value="Kintambo">Kinshasa — Kintambo</option>
              <option value="Lubumbashi">Lubumbashi</option>
              <option value="Goma">Goma</option>
              <option value="Matadi">Matadi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1">Quartier / Avenue *</label>
            <input
              required
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
              placeholder="ex: Avenue Colonel Mondjiba"
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2 text-xs text-encre outline-none focus:border-seve"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1">Point de repère (indispensable)</label>
            <input
              value={referencePoint}
              onChange={(e) => setReferencePoint(e.target.value)}
              placeholder="ex: En face de l'immeuble X, portail vert"
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-3.5 py-2 text-xs text-encre outline-none focus:border-seve"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !quartier.trim()}
            className="w-full rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold py-2.5 text-xs transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Enregistrement…' : 'Ajouter au carnet'}</span>
          </button>
        </form>
      </div>

      {/* Saved Wishlist Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-nuit flex items-center gap-2">
            <Heart className="w-5 h-5 text-wax" />
            <span>Articles Favoris ({wishlistedProducts.length})</span>
          </h2>
          <Link to="/products?favorites=1" className="text-xs font-semibold text-seve hover:underline">
            Voir dans le catalogue &rarr;
          </Link>
        </div>

        {wishlistedProducts.length === 0 ? (
          <div className="p-6 rounded-card bg-white border border-dashed border-encre/20 text-xs text-encre/60">
            Cliquez sur le cœur d’un article dans le catalogue pour le retrouver ici.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {wishlistedProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="rounded-card bg-white border border-encre/10 p-3 flex items-center gap-3 hover:border-seve transition"
              >
                {p.images?.[0] && (
                  <img src={p.images[0].url} alt={p.title} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-xs text-nuit truncate">{p.title}</p>
                  <p className="font-display text-sm font-extrabold text-seve mt-0.5 tabular-nums">
                    {formatPrimaryPrice(p.basePriceUsd)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
