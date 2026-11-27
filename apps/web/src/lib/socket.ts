import { io, type Socket } from 'socket.io-client';
import { getAccessToken, isRealApiMode, onAccessTokenChanged } from './api';

const sockets: Partial<Record<'/notifications' | '/chat' | '/tracking', Socket>> = {};

/**
 * Une seule connexion par namespace, réutilisée entre les composants —
 * évite de rouvrir un socket à chaque montage de composant. Le token est lu
 * au moment de la connexion ; si l'access token change ensuite (refresh),
 * reconnectSocket() doit être appelé pour renvoyer un handshake à jour.
 */
export function getSocket(namespace: '/notifications' | '/chat' | '/tracking'): Socket {
  const existing = sockets[namespace];
  if (existing) return existing;

  const socket = io(namespace, {
    auth: { token: getAccessToken() },
    withCredentials: true,
    autoConnect: isRealApiMode,
  });

  sockets[namespace] = socket;
  return socket;
}

export function reconnectSocket(namespace: '/notifications' | '/chat' | '/tracking') {
  if (!isRealApiMode) return;
  const socket = sockets[namespace];
  if (!socket) return;
  socket.auth = { token: getAccessToken() };
  socket.disconnect().connect();
}

export function disconnectAllSockets() {
  for (const key of Object.keys(sockets) as (keyof typeof sockets)[]) {
    sockets[key]?.disconnect();
    delete sockets[key];
  }
}

onAccessTokenChanged((token) => {
  if (token) {
    for (const namespace of ['/notifications', '/chat', '/tracking'] as const) {
      reconnectSocket(namespace);
    }
  } else {
    disconnectAllSockets();
  }
});
