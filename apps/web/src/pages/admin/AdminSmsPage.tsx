import { FormEvent, useEffect, useState } from 'react';
import { MessageSquareCode, RefreshCw, Send, ShieldBan } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';

interface SmsLogRecord {
  id?: string;
  eventType?: string;
  phoneNumber?: string;
  to?: string;
  status?: string;
  message?: string;
  text?: string;
  networkCode?: string;
  receivedAt?: string;
  createdAt?: string;
}

export function AdminSmsPage() {
  const [logs, setLogs] = useState<SmsLogRecord[]>([]);
  const [optOuts, setOptOuts] = useState<string[]>([]);
  const [inbox, setInbox] = useState<SmsLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [phonesInput, setPhonesInput] = useState('+243810000001');
  const [messageText, setMessageText] = useState('ZandoGo : Test de notification SMS opérationnelle RDC.');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<SmsLogRecord[]>('/sms/callbacks/logs?limit=50').catch(() => ({ data: [] })),
      api.get<string[] | { optOuts?: string[] }>('/sms/opt-outs').catch(() => ({ data: [] })),
      api.get<SmsLogRecord[] | { messages?: SmsLogRecord[] }>('/sms/inbox').catch(() => ({ data: [] })),
    ])
      .then(([logsRes, optRes, inboxRes]) => {
        setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
        const rawOpt = optRes.data;
        setOptOuts(Array.isArray(rawOpt) ? rawOpt : rawOpt?.optOuts || []);
        const rawInbox = inboxRes.data;
        setInbox(Array.isArray(rawInbox) ? rawInbox : rawInbox?.messages || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  async function handleSendBulk(e: FormEvent) {
    e.preventDefault();
    const phoneNumbers = phonesInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (phoneNumbers.length === 0 || !messageText.trim()) {
      setError('Saisissez au moins un numéro (+243…) et un message.');
      return;
    }

    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const { data } = await api.post('/sms/bulk', {
        phoneNumbers,
        message: messageText.trim(),
        enqueue: 1,
      });
      setSendResult(
        `Campagne envoyée vers ${phoneNumbers.length} destinataire(s) · Statut : ${
          data?.summary || data?.status || 'DISPATCHED'
        }`,
      );
      loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || "Échec de l'envoi SMS.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran">
              Passerelle Télécom Africa’s Talking
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Console SMS RDC, Rapports &amp; Opt-Outs
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Envoyez des alertes SMS groupées, inspectez les accusés de réception (DLR) et gérez les désabonnements STOP.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-card bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-brume transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <form onSubmit={handleSendBulk} className="rounded-card bg-nuit/80 border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <Send className="w-4 h-4 text-safran" />
              <span>Envoi SMS groupé / Test passerelle</span>
            </div>

            <div>
              <label className="block text-xs text-brume/70 mb-1.5">
                Numéros destinataires (séparés par virgule ou retour à la ligne)
              </label>
              <textarea
                rows={2}
                value={phonesInput}
                onChange={(e) => setPhonesInput(e.target.value)}
                placeholder="+243810000001, +243990000002"
                className="w-full rounded-card bg-[#111917] border border-white/15 px-3 py-2 text-xs font-mono text-white outline-none focus:border-safran"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-brume/70 mb-1.5">
                <label>Contenu du SMS (max 480 caractères)</label>
                <span className="font-mono text-[11px]">{messageText.length}/480</span>
              </div>
              <textarea
                rows={3}
                maxLength={480}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full rounded-card bg-[#111917] border border-white/15 px-3 py-2 text-xs text-white outline-none focus:border-safran"
              />
            </div>

            {sendResult && (
              <div className="rounded-card bg-seve/15 border border-seve/40 px-3 py-2 text-xs text-emerald-200">
                {sendResult}
              </div>
            )}
            {error && (
              <div className="rounded-card bg-wax/15 border border-wax/40 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-white font-display font-bold text-xs transition disabled:opacity-50"
            >
              {sending ? 'Expédition…' : 'Envoyer le SMS'}
            </button>
          </form>

          <div className="rounded-card bg-nuit/80 border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <ShieldBan className="w-4 h-4 text-wax" />
                <span>Numéros désabonnés (Opt-Outs)</span>
              </h2>
              <span className="font-mono text-xs text-brume/60">{optOuts.length}</span>
            </div>
            {optOuts.length === 0 ? (
              <p className="text-xs text-brume/60">Aucun numéro sur liste d’exclusion SMS actuellement.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto text-xs font-mono text-rose-200">
                {optOuts.map((num) => (
                  <li key={num} className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10">
                    {num}
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-3 border-t border-white/10">
              <h3 className="font-display font-bold text-xs text-white mb-2">Messages entrants (Inbox)</h3>
              {inbox.length === 0 ? (
                <p className="text-xs text-brume/55">Aucun SMS entrant récent.</p>
              ) : (
                <ul className="space-y-2 max-h-36 overflow-y-auto text-xs">
                  {inbox.map((m, idx) => (
                    <li key={m.id || idx} className="p-2 rounded bg-white/5 border border-white/10">
                      <span className="font-mono text-safran">{m.phoneNumber || m.to || 'Client'}</span>
                      <p className="text-brume/85 mt-0.5">{m.text || m.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-card bg-nuit/80 border border-white/10 p-5 space-y-4">
          <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
            <MessageSquareCode className="w-4 h-4 text-safran" />
            <span>Journal des envois &amp; accusés de réception (DLR)</span>
          </h2>
          {loading ? (
            <p className="text-xs text-brume/60 font-mono">Chargement des journaux SMS…</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-brume/60">Aucun événement SMS enregistré pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-b border-white/10 text-[10px] uppercase text-brume/55 font-display">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Type / Statut</th>
                    <th className="py-2 pr-4">Numéro</th>
                    <th className="py-2">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log, i) => (
                    <tr key={log.id || i}>
                      <td className="py-2.5 pr-4 font-mono text-[11px] text-brume/60">
                        {log.receivedAt || log.createdAt
                          ? new Date(log.receivedAt || log.createdAt || '').toLocaleString('fr-FR')
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-safran">
                          {log.status || log.eventType || 'LOG'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-white">{log.phoneNumber || log.to || '—'}</td>
                      <td className="py-2.5 text-brume/80">{log.message || log.text || log.networkCode || 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
