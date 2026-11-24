import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  Cpu,
  Cloud,
  AlertTriangle,
  Bot,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  AI_LANGUAGES,
  type AiLanguage,
  getPreferredAiLanguage,
  getPreferredAiModel,
  setPreferredAiLanguage,
  setPreferredAiModel,
} from '../lib/ai-preference';
import { useAuth } from '../lib/auth-context';

interface AssistantStatus {
  available: boolean;
  mode: 'auto' | 'local' | 'cloud';
  activeEngine: 'ollama' | 'gemini' | 'none';
  activeModel: string | null;
  ollamaReachable: boolean;
  ollamaModels: string[];
  cloudConfigured: boolean;
  cloudModel: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'ollama' | 'gemini' | 'none';
  model?: string;
}

export function AssistantWidget() {
  const location = useLocation();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>(() => getPreferredAiModel());
  const [selectedLang, setSelectedLang] = useState<AiLanguage>(() => getPreferredAiLanguage());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const roleContext = useMemo<'CLIENT' | 'VENDOR' | 'ADMIN'>(() => {
    if (location.pathname.startsWith('/admin')) return 'ADMIN';
    if (location.pathname.startsWith('/vendor')) return 'VENDOR';
    const isAdmin = Boolean(user?.roles?.some((r) => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN'));
    if (isAdmin && location.pathname === '/') return 'CLIENT';
    return 'CLIENT';
  }, [location.pathname, user]);

  const quickPrompts = useMemo(() => {
    if (roleContext === 'ADMIN') {
      return [
        'Rappelle les règles de blocage de retrait en cas de litige',
        'Comment ajuster les frais de transaction et le retrait immédiat ?',
        'Quelles agences de transport sont actives sur ZandoGo ?',
      ];
    }
    if (roleContext === 'VENDOR') {
      return [
        'Comment fonctionne le décompte de 48h et le retrait immédiat ?',
        'Comment configurer mes tarifs dégressifs et couleurs personnalisées ?',
        'Conseils pour vendre des livres PDF ou trajets de transport',
      ];
    }
    return [
      'Quelles agences de transport desservent Kinshasa ou Bukavu ?',
      'Comment fonctionnent les frais de paiement et le séquestre 48h ?',
      'Quels livres PDF puis-je télécharger directement après paiement ?',
    ];
  }, [roleContext]);

  async function refreshStatus(preferred?: string) {
    setStatusLoading(true);
    try {
      const activePref = preferred !== undefined ? preferred : getPreferredAiModel();
      const qs = activePref ? `?preferredModel=${encodeURIComponent(activePref)}` : '';
      const { data } = await api.get<AssistantStatus>(`/assistant/status${qs}`);
      setStatus(data);
      if (activePref && data.ollamaReachable && !data.ollamaModels.includes(activePref)) {
        setSelectedLocalModel('');
        setPreferredAiModel('');
      }
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

  async function loadPersistedHistory() {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data } = await api.get<{ messages?: ChatMessage[] }>(
        `/assistant/history?roleContext=${encodeURIComponent(roleContext)}`,
      );
      if (Array.isArray(data?.messages)) {
        setMessages(data.messages);
      }
    } catch {
      // Keep local messages if history endpoint fails silently
    } finally {
      setHistoryLoading(false);
    }
  }

  async function clearConversation() {
    setError(null);
    setMessages([]);
    if (user) {
      try {
        await api.delete(`/assistant/history?roleContext=${encodeURIComponent(roleContext)}`);
      } catch {
        // Ignore network failure after clearing local view
      }
    }
  }

  useEffect(() => {
    if (open) {
      refreshStatus(selectedLocalModel);
      if (user) {
        loadPersistedHistory();
      }
    }
  }, [open, user?.id, roleContext]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post<{ reply: string; engine: 'ollama' | 'gemini'; model: string }>(
        '/assistant/chat',
        {
          message: trimmed,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          roleContext,
          preferredModel: selectedLocalModel || getPreferredAiModel() || undefined,
          currentRoute: location.pathname,
          language: selectedLang,
        },
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          engine: data.engine,
          model: data.model,
        },
      ]);
      refreshStatus(selectedLocalModel);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Impossible de joindre l'assistant IA pour le moment. Vérifiez Ollama en local ou le service en ligne.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-card bg-nuit hover:bg-nuit/95 text-safran border border-safran/40 px-4 py-3 text-xs font-display font-bold shadow-xl transition-transform hover:-translate-y-0.5"
          aria-label="Ouvrir l'Assistant IA ZandoGo"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Assistant ZandoGo</span>
        </button>
      )}

      {/* Assistant drawer */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] max-h-[82vh] flex flex-col rounded-card bg-white border border-encre/15 shadow-2xl overflow-hidden text-encre"
          role="dialog"
          aria-label="Assistant IA Hybride ZandoGo"
        >
          {/* Header */}
          <div className="bg-nuit text-white px-4 py-3.5 border-b border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-card bg-safran text-nuit flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm text-white truncate">
                    Assistant IA ZandoGo
                  </p>
                  <p className="text-[10px] text-brume/65 truncate">
                    Mode {roleContext === 'ADMIN' ? 'Super Admin' : roleContext === 'VENDOR' ? 'Vendeur' : 'Client RDC'}
                    {user ? ' · Historique sauvegardé' : ' · Session visiteur'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearConversation}
                    title="Effacer la conversation"
                    aria-label="Effacer la conversation"
                    className="p-1.5 rounded-lg text-brume/70 hover:text-wax hover:bg-white/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => refreshStatus(selectedLocalModel || undefined)}
                  disabled={statusLoading || historyLoading}
                  title="Re-détecter Ollama local / Cloud"
                  className="p-1.5 rounded-lg text-brume/70 hover:text-safran hover:bg-white/10 transition disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${statusLoading || historyLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Fermer l'assistant"
                  className="p-1.5 rounded-lg text-brume/70 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Detected Engine Status Strip */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {status?.activeEngine === 'ollama' ? (
                <span className="inline-flex items-center gap-1.5 text-seve font-semibold bg-seve/15 border border-seve/35 px-2 py-0.5 rounded">
                  <Cpu className="w-3 h-3 shrink-0" />
                  <span>Local · Ollama ({status.activeModel})</span>
                </span>
              ) : status?.activeEngine === 'gemini' ? (
                <span className="inline-flex items-center gap-1.5 text-safran font-semibold bg-safran/15 border border-safran/35 px-2 py-0.5 rounded">
                  <Cloud className="w-3 h-3 shrink-0" />
                  <span>En ligne · Modèle Cloud</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-wax font-semibold bg-wax/15 border border-wax/35 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{statusLoading ? 'Détection…' : 'Aucun moteur actif'}</span>
                </span>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={selectedLang}
                  onChange={(e) => {
                    const nextLang = e.target.value as AiLanguage;
                    setSelectedLang(nextLang);
                    setPreferredAiLanguage(nextLang);
                  }}
                  title="Langue de réponse de l'assistant"
                  aria-label="Langue de réponse de l'assistant"
                  className="rounded bg-white/10 border border-white/15 px-2 py-0.5 text-[10px] font-mono text-brume outline-none focus:border-safran"
                >
                  {AI_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-nuit text-white">
                      {l.label}
                    </option>
                  ))}
                </select>

                {status && status.ollamaModels.length > 1 && (
                  <select
                    value={selectedLocalModel}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedLocalModel(next);
                      setPreferredAiModel(next);
                      refreshStatus(next);
                    }}
                    title="Modèle Ollama utilisé dans toute l'application"
                    aria-label="Choisir le modèle Ollama local"
                    className="rounded bg-white/10 border border-white/15 px-2 py-0.5 text-[10px] font-mono text-brume outline-none focus:border-safran max-w-[140px]"
                  >
                    <option value="" className="bg-nuit text-white">
                      Auto ({status.activeModel || status.ollamaModels[0]})
                    </option>
                    {status.ollamaModels.map((m) => (
                      <option key={m} value={m} className="bg-nuit text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-brume/35 min-h-[240px] max-h-[420px]">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-card bg-white border border-encre/10 text-xs text-encre/80 leading-relaxed">
                  Bonjour ! Je détecte automatiquement <strong>Ollama en local</strong> sur votre ordinateur lorsque vous testez hors ligne, et je bascule sur le <strong>modèle en ligne</strong> dès que la plateforme est déployée. Posez-moi une question :
                </div>
                <div className="space-y-1.5">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => sendMessage(qp)}
                      className="w-full text-left px-3 py-2 rounded-card bg-white hover:bg-safran/15 border border-encre/10 hover:border-safran/50 text-[11px] font-medium text-nuit transition"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-card px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-nuit text-brume font-medium'
                        : 'bg-white border border-encre/10 text-encre shadow-2xs'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.model && (
                    <span className="mt-1 text-[10px] font-mono text-encre/45 px-1">
                      {m.engine === 'ollama' ? `Ollama local (${m.model})` : `Cloud (${m.model})`}
                    </span>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex items-start">
                <div className="rounded-card bg-white border border-encre/10 px-3.5 py-2.5 text-xs text-encre/60 font-medium">
                  Réflexion en cours…
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-card bg-wax/10 border border-wax/30 text-[11px] text-wax font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-encre/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question ZandoGo…"
              className="flex-1 rounded-card border border-encre/20 bg-brume/30 px-3 py-2 text-xs text-encre outline-none focus:border-seve"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center justify-center rounded-card bg-seve hover:bg-seve/90 text-white p-2.5 disabled:opacity-50 transition"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
