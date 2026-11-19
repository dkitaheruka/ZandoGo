import { useEffect, useState } from 'react';
import { Bot, RefreshCw, Sparkles, MessageSquare, Smartphone, Cpu, Cloud, ShieldCheck, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';

interface AiMessageLogItem {
  id: string;
  scenario: string;
  channel: 'inapp' | 'sms';
  recipientRole: 'CLIENT' | 'VENDOR' | 'DELIVERY';
  recipientName: string | null;
  personalized: boolean;
  engine: 'ollama' | 'gemini' | 'none';
  model: string | null;
  finalText: string;
  latencyMs: number;
  createdAt: string;
}

interface AiMessageLogStats {
  total: number;
  personalizedCount: number;
  fallbackCount: number;
  personalizationRate: number;
  avgLatencyMs: number;
}

interface AiSettingsState {
  autoMessagesEnabled: boolean;
  autoMessagesTone: 'WARM' | 'FORMAL' | 'CONCISE';
  updatedAt?: string;
}

const SCENARIO_LABELS: Record<string, string> = {
  ALL: 'Tous les scénarios',
  ORDER_PAID_DIGITAL: 'Commande Livre PDF payée',
  ORDER_PAID_PHYSICAL: 'Commande Physique / Service payée',
  ORDER_CASH_CONFIRMED: 'Paiement Cash confirmé',
  DELIVERY_COMPLETED: 'Livraison terminée',
  STORE_CREATED_OR_SERVICE: 'Boutique ou module activé',
  VENDOR_PAYOUT_STATUS: 'Retrait vendeur approuvé / rejeté',
  DISPUTE_UPDATE: 'Mise à jour / Arbitrage litige',
  KYC_REVIEWED: 'Validation / Rejet KYC',
};

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  VENDOR: 'Vendeur / Agence',
  DELIVERY: 'Livreur',
};

export function AiLogsPage() {
  const [items, setItems] = useState<AiMessageLogItem[]>([]);
  const [stats, setStats] = useState<AiMessageLogStats>({
    total: 0,
    personalizedCount: 0,
    fallbackCount: 0,
    personalizationRate: 0,
    avgLatencyMs: 0,
  });
  const [aiSettings, setAiSettings] = useState<AiSettingsState>({
    autoMessagesEnabled: true,
    autoMessagesTone: 'WARM',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [scenario, setScenario] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [loading, setLoading] = useState(true);

  async function loadLogs(nextScenario = scenario, nextChannel = channel) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (nextScenario !== 'ALL') qs.set('scenario', nextScenario);
      if (nextChannel !== 'ALL') qs.set('channel', nextChannel);
      const [{ data }, settingsRes] = await Promise.all([
        api.get<{ items: AiMessageLogItem[]; stats: AiMessageLogStats }>(
          `/assistant/message-logs?${qs.toString()}`,
        ),
        api.get<AiSettingsState>('/assistant/settings').catch(() => ({ data: null })),
      ]);
      setItems(data?.items || []);
      if (data?.stats) setStats(data.stats);
      if (settingsRes.data) setAiSettings(settingsRes.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveAiSettings(patch: Partial<AiSettingsState>) {
    setSavingSettings(true);
    setSettingsNotice(null);
    try {
      const payload = {
        autoMessagesEnabled:
          patch.autoMessagesEnabled !== undefined
            ? patch.autoMessagesEnabled
            : aiSettings.autoMessagesEnabled,
        autoMessagesTone: patch.autoMessagesTone ?? aiSettings.autoMessagesTone,
      };
      const { data } = await api.put<AiSettingsState>('/assistant/settings', payload);
      if (data) setAiSettings(data);
      setSettingsNotice(
        payload.autoMessagesEnabled
          ? 'Personnalisation IA des notifications & SMS activée.'
          : 'Personnalisation IA mise en pause : les modèles standards instantanés sont utilisés.',
      );
    } catch {
      setSettingsNotice('Impossible de mettre à jour les paramètres IA.');
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    loadLogs(scenario, channel);
  }, [scenario, channel]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran">
              Traçabilité & Qualité IA
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-white tracking-tight">
              Journal des Messages Automatiques IA
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Activez ou mettez en pause la personnalisation IA et supervisez les notifications et SMS courts envoyés pour les 8 scénarios ciblés.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadLogs(scenario, channel)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-card bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2 text-xs font-display font-semibold text-brume transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Super Admin AI Switch & Tone Control */}
        <div className="p-5 rounded-card bg-nuit/60 border border-safran/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-display font-bold uppercase tracking-wider text-safran flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Contrôle Super Admin — Messages Automatiques IA</span>
            </p>
            <p className="text-xs text-brume/75">
              Désactivez en un clic si vous souhaitez revenir temporairement aux textes standards fixes sur toute la plateforme.
            </p>
            {settingsNotice && (
              <p className="text-[11px] text-seve font-medium inline-flex items-center gap-1 pt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{settingsNotice}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Ton des messages IA"
              disabled={savingSettings}
              value={aiSettings.autoMessagesTone}
              onChange={(e) =>
                saveAiSettings({ autoMessagesTone: e.target.value as AiSettingsState['autoMessagesTone'] })
              }
              className="rounded-card bg-[#111917] border border-white/15 px-3 py-2 text-xs text-brume outline-none focus:border-safran"
            >
              <option value="WARM">Ton : Chaleureux & proche</option>
              <option value="FORMAL">Ton : Formel & professionnel</option>
              <option value="CONCISE">Ton : Ultra-concis</option>
            </select>

            <button
              type="button"
              role="switch"
              disabled={savingSettings}
              aria-checked={aiSettings.autoMessagesEnabled}
              onClick={() => saveAiSettings({ autoMessagesEnabled: !aiSettings.autoMessagesEnabled })}
              className={`px-4 py-2 rounded-full text-xs font-display font-bold transition disabled:opacity-50 ${
                aiSettings.autoMessagesEnabled
                  ? 'bg-seve text-brume shadow-xs'
                  : 'bg-white/10 text-brume/70 border border-white/15'
              }`}
            >
              {aiSettings.autoMessagesEnabled ? 'IA ACTIVÉE' : 'IA EN PAUSE'}
            </button>
          </div>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <p className="text-xs text-brume/70 font-medium">Messages tracés</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{stats.total}</p>
            <p className="mt-1 text-[11px] text-brume/55">Notifications & SMS ciblés</p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <p className="text-xs text-brume/70 font-medium">Personnalisés par IA</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-seve">
              {stats.personalizedCount} ({stats.personalizationRate}%)
            </p>
            <p className="mt-1 text-[11px] text-brume/55">Ton chaleureux vérifié</p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <p className="text-xs text-brume/70 font-medium">Repli modèle standard</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-safran">{stats.fallbackCount}</p>
            <p className="mt-1 text-[11px] text-brume/55">Garantie anti-délai / hors ligne</p>
          </div>

          <div className="p-5 rounded-card bg-nuit/60 border border-white/10">
            <p className="text-xs text-brume/70 font-medium">Latence moyenne</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">
              {stats.avgLatencyMs} ms
            </p>
            <p className="mt-1 text-[11px] text-brume/55">Plafonné sous 2 600 ms</p>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-card bg-nuit/60 border border-white/10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="ai-log-scenario" className="text-xs text-brume/70 font-medium">
              Scénario :
            </label>
            <select
              id="ai-log-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="rounded-card bg-[#111917] border border-white/15 px-3 py-1.5 text-xs text-brume outline-none focus:border-safran"
            >
              {Object.entries(SCENARIO_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="ai-log-channel" className="text-xs text-brume/70 font-medium">
              Canal :
            </label>
            <select
              id="ai-log-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-card bg-[#111917] border border-white/15 px-3 py-1.5 text-xs text-brume outline-none focus:border-safran"
            >
              <option value="ALL">Tous les canaux</option>
              <option value="inapp">Notification In-App</option>
              <option value="sms">SMS court</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="rounded-card bg-nuit/60 border border-white/10 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs font-mono text-brume/60">
              Chargement du journal IA…
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Bot className="w-8 h-8 text-safran/60 mx-auto" />
              <p className="text-sm font-display font-semibold text-white">Aucun message enregistré pour ce filtre</p>
              <p className="text-xs text-brume/60">
                Les prochains paiements, livraisons, validations KYC ou arbitrages apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {items.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white font-display font-semibold">
                        {SCENARIO_LABELS[item.scenario] || item.scenario}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                          item.channel === 'sms'
                            ? 'bg-safran/15 text-safran border border-safran/30'
                            : 'bg-seve/15 text-seve border border-seve/30'
                        }`}
                      >
                        {item.channel === 'sms' ? (
                          <>
                            <Smartphone className="w-3 h-3" /> SMS
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3 h-3" /> In-App
                          </>
                        )}
                      </span>

                      <span className="text-brume/70">
                        Destinataire :{' '}
                        <strong className="text-brume">
                          {ROLE_LABELS[item.recipientRole] || item.recipientRole}
                          {item.recipientName ? ` (${item.recipientName})` : ''}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-brume/60">
                      {item.personalized ? (
                        <span className="inline-flex items-center gap-1 text-seve bg-seve/10 border border-seve/30 px-2 py-0.5 rounded">
                          {item.engine === 'ollama' ? (
                            <Cpu className="w-3 h-3" />
                          ) : item.engine === 'gemini' ? (
                            <Cloud className="w-3 h-3" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>
                            {item.engine === 'ollama'
                              ? `Ollama (${item.model || 'local'})`
                              : item.engine === 'gemini'
                              ? 'Modèle en ligne'
                              : 'IA'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-brume/70 bg-white/5 border border-white/15 px-2 py-0.5 rounded">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Modèle standard</span>
                        </span>
                      )}
                      <span className="tabular-nums">{item.latencyMs} ms</span>
                      <span>{new Date(item.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>

                  <p className="text-xs text-brume/90 leading-relaxed bg-[#111917] border border-white/10 rounded-card px-3.5 py-2.5">
                    {item.finalText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
