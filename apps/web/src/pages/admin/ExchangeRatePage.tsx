import { FormEvent, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { ExchangeRateHistoryItem, ExchangeRatePayload } from '../../lib/types';

export function ExchangeRatePage() {
  const { refreshExchangeRate } = useStore();
  const [history, setHistory] = useState<ExchangeRateHistoryItem[]>([
    { id: 'rate-1', rate: 2850, effectiveFrom: new Date().toISOString() },
  ]);
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<ExchangeRatePayload>('/finance/exchange-rates')
      .then(({ data }) => {
        if (data?.history && Array.isArray(data.history) && data.history.length > 0) {
          setHistory(data.history);
        } else if (data?.rate) {
          setHistory([{ id: 'rate-current', rate: data.rate, effectiveFrom: data.updatedAt || new Date().toISOString() }]);
        }
      })
      .catch(() => {});
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data } = await api.post<ExchangeRatePayload>('/finance/exchange-rates', {
        fromCurrency: 'USD',
        toCurrency: 'CDF',
        rate: Number(rate),
      });
      if (data?.history) {
        setHistory(data.history);
      } else {
        setHistory((prev) => [
          { id: `rate-${Date.now()}`, rate: Number(rate), effectiveFrom: new Date().toISOString() },
          ...prev,
        ]);
      }
      await refreshExchangeRate();
      setSuccess(`Nouveau taux officiel fixé à 1 USD = ${Number(rate).toLocaleString('fr-FR')} CDF. Le catalogue est actualisé.`);
      setRate('');
    } catch {
      setError("Impossible d'enregistrer le nouveau taux de change.");
    } finally {
      setSaving(false);
    }
  }

  const current = history[0];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Paramètres Financiers</p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Taux de Change Officiel (USD / CDF)
          </h1>
          <p className="mt-1 text-xs text-brume/70">
            Fixation de la parité monétaire appliquée aux conversions automatiques des catalogues et paniers à Goma (Nord-Kivu) et dans toute la RDC.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-card bg-seve/10 border border-seve/30 text-xs text-seve font-medium">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Rate Card */}
          <div className="p-6 rounded-card bg-nuit/60 border border-white/10">
            <span className="text-xs text-brume/70 font-medium">Taux Actuellement en Vigueur</span>
            <p className="mt-2 font-display text-3xl font-bold text-seve tabular-nums">
              1 USD = {current ? Number(current.rate).toLocaleString('fr-FR') : '2 850'} CDF
            </p>
            <p className="mt-2 text-xs text-brume/60">
              Appliqué en temps réel sur les prix en Francs congolais des boutiques physiques et numériques.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-white/10 space-y-4">
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-brume/80" htmlFor="rate">
                Ajuster le taux officiel (1 USD = ? CDF)
              </label>
              <div className="flex gap-2">
                <input
                  id="rate"
                  required
                  type="number"
                  min={100}
                  step="10"
                  placeholder="ex: 2880"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="flex-1 rounded-card bg-white/5 border border-white/10 px-4 py-2.5 font-display text-sm text-white outline-none focus:border-seve"
                />
                <button
                  type="submit"
                  disabled={saving || !rate}
                  className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-50 shrink-0 shadow-xs"
                >
                  {saving ? 'Enregistrement…' : 'Appliquer'}
                </button>
              </div>
            </form>
          </div>

          {/* Rate History */}
          <div className="p-6 rounded-card bg-nuit/60 border border-white/10 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-brume/70 mb-3">
                Historique des actualisations
              </h2>
              <ul className="divide-y divide-white/5 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="py-2.5 flex items-center justify-between">
                    <span className="font-display font-semibold text-brume tabular-nums">
                      1 $ = {Number(h.rate).toLocaleString('fr-FR')} CDF
                    </span>
                    <span className="text-[11px] text-brume/50 font-mono">
                      {new Date(h.effectiveFrom).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 p-3 rounded-card bg-white/5 border border-white/10 text-[11px] text-brume/60">
              💡 Règle de gestion : Les commandes passées conservent historiquement le taux de change actif au moment de leur paiement.
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
