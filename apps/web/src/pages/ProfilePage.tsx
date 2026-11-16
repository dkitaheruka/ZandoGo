import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Trash2, CheckCircle2, ShieldCheck, Store, Bike, Heart, User as UserIcon, Mail, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import type { Address, Product } from '../lib/types';

const GOMA_COORDS: Record<string, { lat: number; lng: number }> = {
  'Goma — Himbi': { lat: -1.6815, lng: 29.2115 },
  'Goma — Les Volcans': { lat: -1.6741, lng: 29.2285 },
  'Goma — Katindo': { lat: -1.6660, lng: 29.2180 },
  'Goma — Keshero / Lac Vert': { lat: -1.6620, lng: 29.1850 },
  'Karisimbi — Birere': { lat: -1.6685, lng: 29.2420 },
  'Karisimbi — Ndosho / Mabanga': { lat: -1.6460, lng: 29.2080 },
  'Sake (Masisi)': { lat: -1.5736, lng: 29.0439 },
  'Bukavu (Sud-Kivu)': { lat: -2.5083, lng: 28.8608 },
  'Butembo (Nord-Kivu)': { lat: 0.1416, lng: 29.2912 },
  'Beni (Nord-Kivu)': { lat: 0.4911, lng: 29.4731 },
  'Bunia (Ituri)': { lat: 1.5594, lng: 30.2522 },
  'Kisangani (Tshopo)': { lat: 0.5153, lng: 25.1910 },
  Lubumbashi: { lat: -11.6609, lng: 27.4794 },
  'Kolwezi (Lualaba)': { lat: -10.7148, lng: 25.4667 },
  Kinshasa: { lat: -4.3217, lng: 15.3125 },
  'Matadi (Kongo-Central)': { lat: -5.8167, lng: 13.4500 },
  'Gisenyi / Kigali (Rwanda)': { lat: -1.7028, lng: 29.2564 },
  'Bujumbura (Burundi)': { lat: -3.3822, lng: 29.3644 },
  'Kampala (Ouganda)': { lat: 0.3476, lng: 32.5825 },
};

export function ProfilePage() {
  const { user } = useAuth();
  const { currency, setCurrency, wishlistIds, formatPrimaryPrice } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [commune, setCommune] = useState('Goma — Himbi');
  const [quartier, setQuartier] = useState('');
  const [referencePoint, setReferencePoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState(user?.email || '');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCommune, setEditCommune] = useState('');
  const [editQuartier, setEditQuartier] = useState('');
  const [editRefPoint, setEditRefPoint] = useState('');

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
      const gps = GOMA_COORDS[commune] || { lat: -1.6741, lng: 29.2285 };
      await api.post('/users/me/addresses', {
        commune,
        quartier: quartier.trim(),
        referencePoint: referencePoint.trim(),
        email: user?.email || undefined,
        latitude: gps.lat,
        longitude: gps.lng,
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

  async function handleLookupByEmail() {
    if (!lookupEmail.trim()) return;
    setLookupBusy(true);
    try {
      const { data } = await api.get<Address[]>('/users/me/addresses/by-email', {
        params: { email: lookupEmail.trim() },
      });
      if (data && data.length > 0) {
        setAddresses(data);
        setNotice(`${data.length} adresse(s) récupérée(s) pour ${lookupEmail.trim()}.`);
      } else {
        setNotice(`Aucune adresse trouvée pour ${lookupEmail.trim()}.`);
      }
    } finally {
      setLookupBusy(false);
    }
  }

  function startEdit(addr: Address) {
    setEditingId(addr.id);
    setEditCommune(addr.commune || '');
    setEditQuartier(addr.quartier || '');
    setEditRefPoint(addr.referencePoint || '');
  }

  async function handleSaveEdit(id: string) {
    if (!editQuartier.trim()) return;
    await api.patch(`/users/me/addresses/${id}`, {
      commune: editCommune.trim(),
      quartier: editQuartier.trim(),
      referencePoint: editRefPoint.trim(),
    });
    setEditingId(null);
    setNotice('Adresse mise à jour ✓');
    loadAddresses();
    setTimeout(() => setNotice(null), 3000);
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

          <div className="p-3.5 rounded-card bg-white border border-encre/15 space-y-2 text-xs">
            <label className="flex items-center gap-1.5 font-display font-bold text-nuit">
              <Mail className="w-3.5 h-3.5 text-seve" />
              <span>Récupérer mes adresses par e-mail</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="votre.email@exemple.com"
                className="flex-1 min-w-[180px] rounded-card border border-encre/20 bg-brume/30 px-3 py-1.5 text-xs text-nuit outline-none focus:border-seve"
              />
              <button
                type="button"
                disabled={lookupBusy || !lookupEmail.trim()}
                onClick={handleLookupByEmail}
                className="px-3.5 py-1.5 rounded-card bg-nuit text-brume font-display font-bold text-xs hover:bg-seve transition disabled:opacity-50"
              >
                {lookupBusy ? 'Recherche…' : 'Récupérer'}
              </button>
            </div>
          </div>

          {addresses.length === 0 ? (
            <div className="p-6 rounded-card bg-white border border-dashed border-encre/20 text-xs text-encre/60">
              Aucune adresse enregistrée pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-card bg-white border shadow-xs ${
                    addr.isDefault ? 'border-seve ring-1 ring-seve/20' : 'border-encre/10'
                  }`}
                >
                  {editingId === addr.id ? (
                    <div className="space-y-2 text-xs">
                      <input
                        type="text"
                        value={editCommune}
                        onChange={(e) => setEditCommune(e.target.value)}
                        placeholder="Commune / Ville"
                        className="w-full rounded-card border border-encre/20 px-3 py-1.5 outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        value={editQuartier}
                        onChange={(e) => setEditQuartier(e.target.value)}
                        placeholder="Quartier"
                        className="w-full rounded-card border border-encre/20 px-3 py-1.5 outline-none focus:border-seve"
                      />
                      <input
                        type="text"
                        value={editRefPoint}
                        onChange={(e) => setEditRefPoint(e.target.value)}
                        placeholder="Point de repère"
                        className="w-full rounded-card border border-encre/20 px-3 py-1.5 outline-none focus:border-seve"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(addr.id)}
                          className="px-3 py-1.5 rounded-card bg-seve text-brume font-display font-bold"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-encre/60 hover:text-nuit"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
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
                        {addr.email && (
                          <p className="text-[11px] font-mono text-seve mt-0.5">{addr.email}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => startEdit(addr)}
                          className="inline-flex items-center gap-1 text-seve hover:underline font-medium"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-encre/70 hover:underline font-medium"
                          >
                            Par défaut
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
                  )}
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
              <option value="Goma — Himbi">Goma — Himbi</option>
              <option value="Goma — Les Volcans">Goma — Les Volcans (Centre-Ville)</option>
              <option value="Goma — Katindo">Goma — Katindo / Terminus</option>
              <option value="Goma — Keshero / Lac Vert">Goma — Keshero / Lac Vert</option>
              <option value="Karisimbi — Birere">Karisimbi — Birere / Kituku</option>
              <option value="Karisimbi — Ndosho / Mabanga">Karisimbi — Ndosho / Mabanga</option>
              <option value="Sake (Masisi)">Sake (Territoire de Masisi)</option>
              <option value="Bukavu (Sud-Kivu)">Bukavu (Sud-Kivu)</option>
              <option value="Butembo (Nord-Kivu)">Butembo (Nord-Kivu)</option>
              <option value="Beni (Nord-Kivu)">Beni (Nord-Kivu)</option>
              <option value="Bunia (Ituri)">Bunia (Ituri)</option>
              <option value="Kisangani (Tshopo)">Kisangani (Tshopo)</option>
              <option value="Lubumbashi">Lubumbashi (Haut-Katanga)</option>
              <option value="Kolwezi (Lualaba)">Kolwezi (Lualaba)</option>
              <option value="Kinshasa">Kinshasa (Toutes communes)</option>
              <option value="Matadi (Kongo-Central)">Matadi (Kongo-Central)</option>
              <option value="Gisenyi / Kigali (Rwanda)">Gisenyi / Kigali (Rwanda)</option>
              <option value="Bujumbura (Burundi)">Bujumbura (Burundi)</option>
              <option value="Kampala (Ouganda)">Kampala (Ouganda)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-encre/70 mb-1">Quartier / Avenue *</label>
            <input
              required
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
              placeholder="ex: Avenue du Tourisme / Boulevard Kanyamuhanga"
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
