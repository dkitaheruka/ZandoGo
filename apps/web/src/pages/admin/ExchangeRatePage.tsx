import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface ExchangeRate {
  id: string;
  rate: string | number;
  effectiveFrom: string;
}

export function ExchangeRatePage() {
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<ExchangeRate[]>('/finance/exchange-rates/history', { params: { from: 'USD', to: 'CDF' } })
      .then(({ data }) => setHistory(data))
      .catch(() => setError("Impossible de charger l'historique des taux."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/finance/exchange-rates', {
        fromCurrency: 'USD',
        toCurrency: 'CDF',
        rate: Number(rate),
      });
      setRate('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Impossible d'enregistrer le taux.");
    } finally {
      setSaving(false);
    }
  }

  const current = history[0];

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Taux de change</h1>
      <p className="mt-2 text-encre/60">
        Saisi manuellement. Chaque nouveau taux s'ajoute à l'historique sans jamais écraser
        l'ancien — les commandes déjà payées conservent le taux appliqué à leur paiement.
      </p>

      {error && (
        <div className="mt-5 text-sm text-wax" role="alert">
          {error} <button onClick={load} className="underline">Réessayer</button>
        </div>
      )}

      <div className="mt-8 border border-encre/10 p-5">
        <p className="text-sm text-encre/50">Taux actuel</p>
        <p className="mt-1 font-display text-3xl font-semibold">
          {loading ? 'Chargement…' : current ? `1 USD = ${Number(current.rate).toLocaleString('fr-FR')} CDF` : 'Aucun taux saisi'}
        </p>
        {current && (
          <p className="mt-1 text-sm text-encre/50">
            Depuis le {new Date(current.effectiveFrom).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium" htmlFor="rate">
          Nouveau taux (1 USD = ? CDF)
        </label>
        <input
          id="rate"
          required
          type="number"
          min={0.0001}
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
        />
        {error && <p className="text-sm text-wax">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-nuit text-brume font-medium px-6 py-2.5 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le taux'}
        </button>
      </form>

      {history.length > 1 && (
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold">Historique</h2>
          <ul className="mt-3 divide-y divide-encre/10 text-sm">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex justify-between">
                <span>{Number(h.rate).toLocaleString('fr-FR')} CDF</span>
                <span className="text-encre/50">{new Date(h.effectiveFrom).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
