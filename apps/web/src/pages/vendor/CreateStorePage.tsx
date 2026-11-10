import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function CreateStorePage() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<'SELF_SHIP' | 'PLATFORM_WAREHOUSE'>('SELF_SHIP');
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
      await api.post('/vendors/stores', { storeName, slug, description, fulfillmentMode });
      navigate('/vendor');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de créer la boutique.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Ouvrir une boutique</h1>
      <p className="mt-2 text-encre/60">
        Votre boutique sera examinée par un administrateur avant d'apparaître sur la place de
        marché.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom de la boutique</label>
          <input
            required
            minLength={2}
            value={storeName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Adresse (slug)</label>
          <div className="flex items-center rounded-lg border border-encre/20 px-4 py-2.5 focus-within:border-seve focus-within:ring-1 focus-within:ring-seve">
            <span className="text-encre/40 text-sm">marche.com/</span>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 outline-none ml-0.5"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Mode de livraison</label>
          <select
            value={fulfillmentMode}
            onChange={(e) => setFulfillmentMode(e.target.value as typeof fulfillmentMode)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
          >
            <option value="SELF_SHIP">J'expédie moi-même mes commandes</option>
            <option value="PLATFORM_WAREHOUSE">Entrepôt de la plateforme</option>
          </select>
        </div>

        {error && <p className="text-sm text-wax">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-nuit text-brume font-medium py-3 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Création…' : 'Soumettre ma boutique'}
        </button>
      </form>
    </div>
  );
}
