import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, getAccessToken, isRealApiMode } from './api';
import { useAuth } from './auth-context';
import type { AdminPresenceSnapshot, PresenceStatus } from './types';

interface PresenceContextValue {
  visitorId: string;
  statuses: Record<string, PresenceStatus>;
  watchUserIds: (ids: string[]) => void;
  getUserStatus: (userId?: string | null) => PresenceStatus | undefined;
  adminSnapshot: AdminPresenceSnapshot | null;
  refreshStatuses: (ids: string[]) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

function getOrCreateVisitorId(): string {
  try {
    const existing = window.sessionStorage.getItem('zg_visitor_id');
    if (existing && existing.length >= 8) return existing;
    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `vis-${crypto.randomUUID()}`
        : `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem('zg_visitor_id', created);
    return created;
  } catch {
    return `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function resolveSocketOrigin(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw) {
    try {
      return new URL(raw, window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  }
  return window.location.origin;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [visitorId] = useState<string>(() => getOrCreateVisitorId());
  const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>({});
  const [adminSnapshot, setAdminSnapshot] = useState<AdminPresenceSnapshot | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const watchedIdsRef = useRef<Set<string>>(new Set());
  const currentPathRef = useRef<string>(location.pathname + location.search);

  useEffect(() => {
    currentPathRef.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  const sendHeartbeat = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    api
      .post('/presence/heartbeat', {
        visitorId,
        currentPath: currentPathRef.current.slice(0, 200),
      })
      .catch(() => {});

    if (socketRef.current?.connected) {
      socketRef.current.emit('presence:ping', {
        currentPath: currentPathRef.current.slice(0, 200),
      });
    }
  }, [visitorId]);

  // Real-time Socket.IO connection in API mode
  useEffect(() => {
    if (!isRealApiMode) return;

    const origin = resolveSocketOrigin();
    const token = getAccessToken();
    const socket = io(`${origin}/presence`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        ...(token ? { token } : {}),
        visitorId,
        currentPath: currentPathRef.current.slice(0, 200),
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const ids = Array.from(watchedIdsRef.current);
      if (ids.length > 0) {
        socket.emit('presence:watch', { userIds: ids }, (res?: { users?: Record<string, PresenceStatus> }) => {
          if (res?.users) {
            setStatuses((prev) => ({ ...prev, ...res.users }));
          }
        });
      }
    });

    socket.on(
      'presence:status_changed',
      (payload: { userId?: string; isOnline?: boolean; lastSeenAt?: string | null }) => {
        if (!payload?.userId) return;
        setStatuses((prev) => ({
          ...prev,
          [payload.userId!]: {
            isOnline: Boolean(payload.isOnline),
            lastSeenAt: payload.lastSeenAt ?? null,
          },
        }));
      },
    );

    socket.on('presence:admin_snapshot', (snapshot: AdminPresenceSnapshot) => {
      if (snapshot?.summary) {
        setAdminSnapshot(snapshot);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, visitorId]);

  // Immediate heartbeat on route/auth change + periodic 20s heartbeat
  useEffect(() => {
    sendHeartbeat();
  }, [location.pathname, location.search, user?.id, sendHeartbeat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      sendHeartbeat();
    }, 20_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    const onUnload = () => {
      const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');
      try {
        const blob = new Blob([JSON.stringify({ visitorId })], { type: 'application/json' });
        navigator.sendBeacon?.(`${base}/presence/leave`, blob);
      } catch {
        // ignore beacon errors
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [sendHeartbeat, visitorId]);

  const refreshStatuses = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 50);
    if (unique.length === 0) return;
    try {
      const { data } = await api.get<{ users: Record<string, PresenceStatus> }>(
        `/presence/users?ids=${encodeURIComponent(unique.join(','))}`,
      );
      if (data?.users) {
        setStatuses((prev) => ({ ...prev, ...data.users }));
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  const watchUserIds = useCallback(
    (ids: string[]) => {
      const clean = ids.map((id) => id.trim()).filter(Boolean);
      if (clean.length === 0) return;
      let addedNew = false;
      for (const id of clean) {
        if (!watchedIdsRef.current.has(id)) {
          watchedIdsRef.current.add(id);
          addedNew = true;
        }
      }
      if (addedNew) {
        refreshStatuses(clean);
        if (socketRef.current?.connected) {
          socketRef.current.emit('presence:watch', { userIds: clean });
        }
      }
    },
    [refreshStatuses],
  );

  // Periodic sync for watched user IDs (keeps mock mode & fallback browsers updated)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const ids = Array.from(watchedIdsRef.current);
      if (ids.length > 0) {
        refreshStatuses(ids);
      }
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [refreshStatuses]);

  const getUserStatus = useCallback(
    (userId?: string | null): PresenceStatus | undefined => {
      if (!userId) return undefined;
      return statuses[userId];
    },
    [statuses],
  );

  const value = useMemo(
    () => ({
      visitorId,
      statuses,
      watchUserIds,
      getUserStatus,
      adminSnapshot,
      refreshStatuses,
    }),
    [visitorId, statuses, watchUserIds, getUserStatus, adminSnapshot, refreshStatuses],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence doit être utilisé dans PresenceProvider.');
  }
  return ctx;
}

export function useUserPresence(userIds: (string | undefined | null)[]) {
  const { watchUserIds, getUserStatus } = usePresence();
  const key = userIds.filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!key) return;
    watchUserIds(key.split(','));
  }, [key, watchUserIds]);

  return getUserStatus;
}
