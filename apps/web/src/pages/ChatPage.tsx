import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Handshake,
  Check,
  Send,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { ChatMessage, Conversation, NegotiationOffer } from '../lib/types';

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedId = (location.state as { conversationId?: string } | null)?.conversationId;

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv-1',
      type: 'CUSTOMER_VENDOR',
      messages: [
        {
          id: 'm-1',
          conversationId: 'conv-1',
          senderId: 'usr-vendor-1',
          content:
            'Bonjour ! Nous avons bien reçu votre proposition de négociation de prix pour le lot de 20 pagnes Super Wax Vlisco.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'm-2',
          conversationId: 'conv-1',
          senderId: 'usr-vendor-1',
          content:
            'Nous pouvons vous accorder un prix de gros spécial de $50.00 par pièce (au lieu du prix catalogue de $65.00). Le devis convenu a été placé sur votre compte.',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
    },
  ]);

  const [activeId, setActiveId] = useState<string | null>('conv-1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationOffer[]>([]);
  const [draft, setDraft] = useState('');
  const [acceptingNotice, setAcceptingNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load negotiations
    api
      .get<NegotiationOffer[]>('/negotiations')
      .then(({ data }) => setNegotiations(data || []))
      .catch(() => {});

    // Try load remote conversations if present
    api
      .get<Conversation[]>('/chat/conversations')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setConversations(data);
          const requested = requestedId && data.find((c) => c.id === requestedId);
          setActiveId(requested ? requested.id : data[0].id);
        }
      })
      .catch(() => {});
  }, [requestedId]);

  useEffect(() => {
    const activeConv = conversations.find((c) => c.id === activeId);
    if (activeConv) {
      setMessages(activeConv.messages || []);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: activeId,
      senderId: user?.id || 'usr-me',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setDraft('');
  }

  async function handleAcceptNegotiatedQuote(neg: NegotiationOffer) {
    setAcceptingNotice('Validation du prix convenu et ajout au panier…');
    try {
      await api.post(`/negotiations/${neg.id}/accept`);
      setAcceptingNotice('Offre spéciale ajoutée au panier avec le tarif négocié !');
      setTimeout(() => {
        navigate('/cart');
      }, 1200);
    } catch {
      setAcceptingNotice('Erreur lors de la validation.');
    }
  }

  const activeNegotiation = negotiations.find(
    (n) => n.status === 'ACCEPTED_BY_VENDOR' || n.status === 'PENDING_VENDOR_REVIEW',
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4" />
            <span>Négociations & Échanges Fournisseurs</span>
          </div>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Messagerie Directe ZandoGo
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Discutez les prix avec les fournisseurs, recevez vos devis sur mesure et concluez vos accords de vente.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Échanges sécurisés par la plateforme</span>
        </div>
      </div>

      {acceptingNotice && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{acceptingNotice}</span>
        </div>
      )}

      {/* Main Chat & Negotiation Box */}
      <div className="mt-6 grid md:grid-cols-[300px_1fr] border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-xs h-[36rem]">
        {/* Left: Conversations list */}
        <div className="border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Fournisseurs en contact
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map((c) => {
              const active = c.id === activeId;
              const lastMsg = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left p-4 transition ${
                    active ? 'bg-amber-50/80 border-l-4 border-amber-500' : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900">Boutique Victoire Wax</span>
                    <span className="text-[10px] text-slate-400 font-mono">14:45</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {lastMsg ? lastMsg.content : 'Nouvelle conversation'}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full">
                    <Handshake className="w-3 h-3 text-amber-700" />
                    <span>Devis spécial convenu</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Chat & Agreed Price Card */}
        <div className="flex flex-col min-h-0 bg-white">
          {/* Header of chat */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
                VW
              </div>
              <div>
                <p className="font-semibold text-xs text-slate-900">Boutique Victoire Wax</p>
                <p className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>En ligne · Vendeur Vérifié Kinshasa</span>
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-400 font-mono">ID: #CONV-B2B-101</span>
          </div>

          {/* Special Negotiation Offer Callout Card (Alibaba Agreed Price Feature) */}
          {activeNegotiation && (
            <div className="m-4 p-4 rounded-xl border-2 border-amber-400 bg-amber-50/80 shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500 text-slate-950 shrink-0">
                    <Handshake className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {activeNegotiation.status === 'ACCEPTED_BY_VENDOR'
                          ? 'Offre de Prix Personnalisée Validée par le Vendeur'
                          : 'Proposition de Devis en Cours d’Étude'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-900">
                        Tarif Convenu
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-1">
                      Article : <strong>{activeNegotiation.productTitle}</strong>
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono">
                      <span>
                        Quantité : <strong>{activeNegotiation.requestedQty} unités</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Prix convenu :{' '}
                        <strong className="text-amber-800 text-sm">
                          ${activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd}
                        </strong>{' '}
                        / unité (au lieu de $65)
                      </span>
                      <span>·</span>
                      <span>
                        Total :{' '}
                        <strong className="text-slate-900">
                          $
                          {(
                            (activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd) *
                            activeNegotiation.requestedQty
                          ).toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {activeNegotiation.status === 'ACCEPTED_BY_VENDOR' && (
                  <button
                    type="button"
                    onClick={() => handleAcceptNegotiatedQuote(activeNegotiation)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Commander au prix négocié</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
            {messages.map((m) => {
              const mine = m.senderId === user?.id || m.senderId === 'usr-me';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      mine
                        ? 'bg-slate-900 text-white rounded-br-none shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs'
                    }`}
                  >
                    <p>{m.content}</p>
                    <span
                      className={`block text-[9px] font-mono mt-1 ${
                        mine ? 'text-slate-400 text-right' : 'text-slate-400'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire au fournisseur (préciser quantité, livraison à Lubumbashi, Goma...)..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-40"
              title="Envoyer le message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
