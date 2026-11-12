import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Handshake,
  Check,
  Send,
  ShieldCheck,
  ArrowRight,
  Truck,
  ExternalLink,
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
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 uppercase tracking-wider">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center gap-1.5 font-bold text-[10px]">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-600" />
              <span>Messagerie Directe & Négociations</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl lg:text-3xl font-extrabold text-slate-950 tracking-tight">
            Échanges Vendeurs & Transporteurs
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Discutez directement le prix de l'article, convenez du moyen de transport et validez vos commandes en toute transparence.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-[#0B0F19] text-white px-3.5 py-2 rounded-xl border border-slate-800 shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-200 font-medium">Séquestre ZandoGo Actif</span>
        </div>
      </div>

      {acceptingNotice && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{acceptingNotice}</span>
        </div>
      )}

      {/* Main Chat & Negotiation Box */}
      <div className="mt-6 grid md:grid-cols-[300px_1fr] border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm h-[38rem]">
        {/* Left: Conversations list */}
        <div className="border-r border-slate-200 flex flex-col bg-slate-50/60">
          <div className="p-3.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Conversations en cours</span>
            <span className="text-[10px] font-mono text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
              RDC
            </span>
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
                    active
                      ? 'bg-[#0B0F19] text-white border-l-4 border-cyan-400 shadow-xs'
                      : 'hover:bg-slate-100/70 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-900'}`}>
                      Boutique Victoire Wax
                    </span>
                    <span className={`text-[10px] font-mono ${active ? 'text-cyan-300' : 'text-slate-400'}`}>
                      14:45
                    </span>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                    {lastMsg ? lastMsg.content : 'Nouvelle conversation'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        active
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <Handshake className="w-3 h-3 text-emerald-500" />
                      <span>Offre convenue</span>
                    </span>
                    <span className={`text-[10px] font-mono flex items-center gap-1 ${active ? 'text-slate-400' : 'text-slate-400'}`}>
                      <Truck className="w-3 h-3 text-cyan-500" />
                      <span>Kinshasa</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Chat & Negotiation Workspace */}
        <div className="flex flex-col min-h-0 bg-white">
          {/* Header of active chat */}
          <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#0B0F19] text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 border border-cyan-500/30">
                VW
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">Boutique Victoire Wax</p>
                <p className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Vendeur Vérifié RDC · En ligne</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-[10px] font-mono text-slate-400">#CONV-101</span>
            </div>
          </div>

          {/* Product Anchor Banner (Tied to the specific product) */}
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={activeNegotiation?.productImage || 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=200&q=80'}
                alt="Produit lié"
                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-cyan-700 tracking-wider block">
                  Produit en discussion :
                </span>
                <span className="font-bold text-slate-900 truncate block text-xs">
                  {activeNegotiation?.productTitle || 'Pagne Super Wax Vlisco Original (6 yards)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-mono block">Prix catalogue</span>
                <span className="font-bold font-mono text-slate-900">$65.00</span>
              </div>
              <Link
                to={activeNegotiation?.productId ? `/products/${activeNegotiation.productId}` : '/products'}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 bg-cyan-50 px-2.5 py-1.5 rounded-lg border border-cyan-200 transition"
              >
                <span>Fiche</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Agreed Product & Transport Terms Card (Noir + Vert + Cyan) */}
          {activeNegotiation && (
            <div className="m-4 p-4 rounded-2xl bg-[#0B0F19] text-white border border-cyan-500/40 shrink-0 shadow-lg relative overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Accord Validé par le Fournisseur</span>
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                      Produit & Transport
                    </span>
                  </div>

                  {/* Dual Terms: Product Price + Transport Fee */}
                  <div className="grid sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">1. Prix Article Convenu</span>
                      <p className="font-mono text-white mt-0.5">
                        <strong className="text-cyan-300 text-sm">
                          ${activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd}
                        </strong>{' '}
                        / unité × {activeNegotiation.requestedQty} pcs
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Sous-total : ${( (activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd) * activeNegotiation.requestedQty ).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">2. Transport & Acheminement</span>
                      <p className="font-mono text-white mt-0.5 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{activeNegotiation.transportMode || 'Coursier Express'}</span>
                      </p>
                      <span className="text-[10px] text-emerald-300 font-mono font-semibold block mt-0.5">
                        Frais convenus : ${activeNegotiation.agreedDeliveryFeeUsd ?? activeNegotiation.requestedDeliveryFeeUsd ?? 3.50} ({activeNegotiation.destinationCity || 'Kinshasa'})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">Total global convenu</span>
                    <span className="text-lg font-mono font-extrabold text-emerald-400">
                      $
                      {(
                        (activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd) *
                          activeNegotiation.requestedQty +
                        (activeNegotiation.agreedDeliveryFeeUsd ?? activeNegotiation.requestedDeliveryFeeUsd ?? 3.50)
                      ).toFixed(2)}
                    </span>
                  </div>

                  {activeNegotiation.status === 'ACCEPTED_BY_VENDOR' && (
                    <button
                      type="button"
                      onClick={() => handleAcceptNegotiatedQuote(activeNegotiation)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition shadow-xs"
                    >
                      <span>Commander au prix négocié</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/40">
            {messages.map((m) => {
              const mine = m.senderId === user?.id || m.senderId === 'usr-me';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      mine
                        ? 'bg-[#0B0F19] text-white border border-cyan-500/30 rounded-br-none shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs'
                    }`}
                  >
                    <p>{m.content}</p>
                    <span
                      className={`block text-[9px] font-mono mt-1 ${
                        mine ? 'text-cyan-400/80 text-right' : 'text-slate-400'
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
              placeholder="Écrire au vendeur (préciser quantité, livraison à Lubumbashi, Goma...)..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
              title="Envoyer le message"
            >
              <span>Envoyer</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
