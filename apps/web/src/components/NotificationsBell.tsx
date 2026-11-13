import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { AppNotification } from '../lib/types';

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<AppNotification[]>('/notifications/mine').then(({ data }) => setNotifications(data));

    const socket = getSocket('/notifications');
    function onNew(notification: AppNotification) {
      setNotifications((prev) => [notification, ...prev]);
    }
    socket.on('notification:new', onNew);

    return () => {
      socket.off('notification:new', onNew);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(notification: AppNotification) {
    if (notification.isRead) return;
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    await api.patch(`/notifications/${notification.id}/read`).catch(() => {});
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await api.patch('/notifications/read-all').catch(() => {});
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-1.5 hover:bg-encre/5 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-wax text-white text-[10px] font-medium rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-card border border-encre/10 shadow-lg z-30">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-encre/10 bg-brume/50">
            <span className="text-xs font-display font-bold text-nuit">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-semibold text-seve hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-encre/50">Aucune notification.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                className={`block w-full text-left p-4 border-b border-encre/5 hover:bg-brume transition-colors ${
                  n.isRead ? '' : 'bg-safran/10'
                }`}
              >
                <p className="text-sm font-medium text-nuit">{n.title}</p>
                <p className="text-xs text-encre/60 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-encre/40 mt-1">{new Date(n.createdAt).toLocaleString('fr-FR')}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
