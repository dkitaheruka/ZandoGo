import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { getSocket } from '../lib/socket';
import type { ChatMessage, Conversation } from '../lib/types';

const TYPE_LABEL: Record<Conversation['type'], string> = {
  CUSTOMER_VENDOR: 'Vendeur',
  CUSTOMER_DELIVERY: 'Livreur',
  SUPPORT: 'Support',
};

export function ChatPage() {
  const { user } = useAuth();
  const location = useLocation();
  const requestedId = (location.state as { conversationId?: string } | null)?.conversationId;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<Conversation[]>('/chat/conversations')
      .then(({ data }) => {
        setConversations(data);
        // Ouvre en priorité la conversation demandée (ex: « Contacter le vendeur »)
        const requested = requestedId && data.find((c) => c.id === requestedId);
        setActiveId(requested ? requested.id : (data[0]?.id ?? null));
      })
      .finally(() => setLoading(false));
  }, []);

  // Charge l'historique, rejoint la room de la conversation, et écoute les nouveaux messages
  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;
    api.get<ChatMessage[]>(`/chat/conversations/${activeId}/messages`).then(({ data }) => {
      if (!cancelled) setMessages(data);
    });

    const socket = getSocket('/chat');
    socket.emit('chat:join', activeId);

    function onNewMessage(message: ChatMessage) {
      if (message.conversationId !== activeId) return;
      // Évite le doublon si le message a déjà été ajouté localement
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }

    socket.on('message:new', onNewMessage);
    return () => {
      cancelled = true;
      socket.off('message:new', onNewMessage);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId) return;
    // Le serveur persiste puis rediffuse via 'message:new' : on n'ajoute pas
    // le message localement ici, pour ne pas afficher un message non enregistré.
    getSocket('/chat').emit('message:send', { conversationId: activeId, content });
    setDraft('');
  }

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-20 text-encre/50">Chargement…</div>;

  if (conversations.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Messagerie</h1>
        <p className="mt-3 text-encre/60">
          Vous n'avez aucune conversation pour l'instant. Elles apparaîtront ici dès que vous
          échangerez avec un vendeur ou un livreur.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Messagerie</h1>

      <div className="mt-6 grid md:grid-cols-[260px_1fr] border border-encre/10 bg-white h-[32rem]">
        <ul className="border-r border-encre/10 overflow-y-auto">
          {conversations.map((c) => {
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-encre/5 hover:bg-brume transition-colors ${
                    c.id === activeId ? 'bg-brume' : ''
                  }`}
                >
                  <p className="text-sm font-medium">{TYPE_LABEL[c.type]}</p>
                  <p className="text-xs text-encre/50 truncate">{last ? last.content : 'Aucun message'}</p>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <p
                    className={`max-w-[75%] px-3.5 py-2 text-sm rounded-2xl ${
                      mine ? 'bg-nuit text-brume' : 'bg-brume text-encre'
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-encre/10 p-3 flex gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              className="flex-1 border border-encre/20 px-4 py-2 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="bg-seve text-white text-sm font-medium px-5 hover:bg-seve/90 transition-colors disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
