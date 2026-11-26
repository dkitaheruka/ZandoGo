import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const SESSION_TTL_MS = 65_000;
const RECENT_OFFLINE_TTL_MS = 15 * 60_000;
const PROFILE_CACHE_TTL_MS = 60_000;

interface CachedUserProfile {
  fullName: string;
  email: string | null;
  roles: string[];
  primaryRole: string;
  cachedAt: number;
}

interface ActiveUserSession {
  userId: string;
  fullName: string;
  email: string | null;
  roles: string[];
  primaryRole: string;
  sockets: Set<string>;
  visitorIds: Set<string>;
  currentPath: string;
  connectedSince: string;
  lastSeenAt: number;
  channel: 'WEBSOCKET' | 'HTTP';
}

interface ActiveVisitorSession {
  visitorId: string;
  currentPath: string;
  userAgentSummary: string;
  startedAt: string;
  lastSeenAt: number;
  pageViews: number;
  lastPath?: string;
}

interface RecentlyOfflineRecord {
  userId: string;
  fullName: string;
  primaryRole: string;
  lastSeenAt: number;
}

export interface UserPresenceStatus {
  isOnline: boolean;
  lastSeenAt: string | null;
}

function resolvePrimaryRole(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('DELIVERY_AGENT')) return 'DELIVERY_AGENT';
  if (roles.includes('VENDOR_OWNER')) return 'VENDOR_OWNER';
  if (roles.includes('VENDOR_STAFF')) return 'VENDOR_STAFF';
  return roles[0] || 'CUSTOMER';
}

function summarizeUserAgent(ua?: string): string {
  if (!ua) return 'Navigateur Web';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Navigateur';
  const os = ua.includes('Android')
    ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad')
      ? 'iOS'
      : ua.includes('Linux')
        ? 'Linux'
        : ua.includes('Windows')
          ? 'Windows'
          : ua.includes('Mac OS')
            ? 'macOS'
            : 'Web';
  return `${browser} · ${os}${isMobile ? ' (Mobile)' : ''}`;
}

function sanitizePath(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '/';
  const cleaned = raw.trim().slice(0, 200);
  if (!cleaned.startsWith('/')) return '/';
  return cleaned;
}

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly activeUsers = new Map<string, ActiveUserSession>();
  private readonly activeVisitors = new Map<string, ActiveVisitorSession>();
  private readonly socketToUser = new Map<string, string>();
  private readonly socketToVisitor = new Map<string, string>();
  private readonly lastSeenAt = new Map<string, number>();
  private readonly recentlyOffline = new Map<string, RecentlyOfflineRecord>();
  private readonly profileCache = new Map<string, CachedUserProfile>();
  private readonly pruneTimer: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    this.pruneTimer = setInterval(() => this.pruneExpired(), 30_000);
    this.pruneTimer.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.pruneTimer);
  }

  private async loadUserProfile(user: AuthenticatedUser): Promise<CachedUserProfile> {
    const cached = this.profileCache.get(user.id);
    const now = Date.now();
    if (cached && now - cached.cachedAt < PROFILE_CACHE_TTL_MS) {
      return cached;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        email: true,
        roles: { select: { role: true } },
      },
    });
    const roles =
      dbUser?.roles?.map((r) => String(r.role)) ||
      user.roles?.map((r) => String(r.role)) || ['CUSTOMER'];
    const profile: CachedUserProfile = {
      fullName: dbUser?.fullName || user.email || 'Utilisateur ZandoGo',
      email: dbUser?.email || user.email || null,
      roles,
      primaryRole: resolvePrimaryRole(roles),
      cachedAt: now,
    };
    this.profileCache.set(user.id, profile);
    return profile;
  }

  pruneExpired(): string[] {
    const now = Date.now();
    const wentOffline: string[] = [];

    for (const [userId, session] of this.activeUsers.entries()) {
      if (session.sockets.size === 0 && now - session.lastSeenAt > SESSION_TTL_MS) {
        this.activeUsers.delete(userId);
        this.lastSeenAt.set(userId, session.lastSeenAt);
        this.recentlyOffline.set(userId, {
          userId,
          fullName: session.fullName,
          primaryRole: session.primaryRole,
          lastSeenAt: session.lastSeenAt,
        });
        wentOffline.push(userId);
      }
    }

    for (const [visitorId, v] of this.activeVisitors.entries()) {
      if (now - v.lastSeenAt > SESSION_TTL_MS) {
        this.activeVisitors.delete(visitorId);
      }
    }

    for (const [userId, rec] of this.recentlyOffline.entries()) {
      if (now - rec.lastSeenAt > RECENT_OFFLINE_TTL_MS) {
        this.recentlyOffline.delete(userId);
      }
    }

    return wentOffline;
  }

  async recordSocketConnect(socketId: string, user?: AuthenticatedUser | null, visitorId?: string, currentPath?: string) {
    const now = Date.now();
    if (user) {
      const profile = await this.loadUserProfile(user);
      const existing = this.activeUsers.get(user.id);
      if (visitorId) {
        this.activeVisitors.delete(visitorId);
      }
      if (existing) {
        existing.sockets.add(socketId);
        if (visitorId) existing.visitorIds.add(visitorId);
        if (currentPath) existing.currentPath = sanitizePath(currentPath);
        existing.lastSeenAt = now;
        existing.channel = 'WEBSOCKET';
        existing.fullName = profile.fullName;
        existing.roles = profile.roles;
        existing.primaryRole = profile.primaryRole;
      } else {
        this.activeUsers.set(user.id, {
          userId: user.id,
          fullName: profile.fullName,
          email: profile.email,
          roles: profile.roles,
          primaryRole: profile.primaryRole,
          sockets: new Set([socketId]),
          visitorIds: visitorId ? new Set([visitorId]) : new Set(),
          currentPath: sanitizePath(currentPath),
          connectedSince: new Date(now).toISOString(),
          lastSeenAt: now,
          channel: 'WEBSOCKET',
        });
      }
      this.recentlyOffline.delete(user.id);
      this.lastSeenAt.set(user.id, now);
      this.socketToUser.set(socketId, user.id);
      return { userId: user.id, isOnline: true, lastSeenAt: new Date(now).toISOString() };
    }

    if (visitorId) {
      const cleanId = visitorId.trim().slice(0, 64);
      if (cleanId) {
        this.socketToVisitor.set(socketId, cleanId);
        const path = sanitizePath(currentPath);
        const existing = this.activeVisitors.get(cleanId);
        if (existing) {
          existing.lastSeenAt = now;
          if (existing.currentPath !== path) {
            existing.currentPath = path;
            existing.pageViews += 1;
          }
        } else {
          this.activeVisitors.set(cleanId, {
            visitorId: cleanId,
            currentPath: path,
            userAgentSummary: 'WebSocket Client',
            startedAt: new Date(now).toISOString(),
            lastSeenAt: now,
            pageViews: 1,
          });
        }
      }
    }
    return null;
  }

  recordSocketDisconnect(socketId: string): { userId: string; isOnline: boolean; lastSeenAt: string } | null {
    const userId = this.socketToUser.get(socketId);
    this.socketToUser.delete(socketId);
    const visitorId = this.socketToVisitor.get(socketId);
    this.socketToVisitor.delete(socketId);

    if (visitorId) {
      this.activeVisitors.delete(visitorId);
    }

    if (!userId) return null;
    const session = this.activeUsers.get(userId);
    if (!session) return null;

    session.sockets.delete(socketId);
    if (session.sockets.size === 0 && session.visitorIds.size === 0) {
      const now = Date.now();
      this.activeUsers.delete(userId);
      this.lastSeenAt.set(userId, now);
      this.recentlyOffline.set(userId, {
        userId,
        fullName: session.fullName,
        primaryRole: session.primaryRole,
        lastSeenAt: now,
      });
      return { userId, isOnline: false, lastSeenAt: new Date(now).toISOString() };
    }
    if (session.sockets.size === 0) {
      session.channel = 'HTTP';
    }
    return null;
  }

  async recordHeartbeat(params: {
    user?: AuthenticatedUser | null;
    visitorId: string;
    currentPath?: string;
    userAgent?: string;
  }): Promise<{ userId?: string; isOnline: boolean; lastSeenAt: string }> {
    const now = Date.now();
    const cleanVisitorId = params.visitorId.trim().slice(0, 64);
    const cleanPath = sanitizePath(params.currentPath);
    this.pruneExpired();

    if (params.user) {
      const profile = await this.loadUserProfile(params.user);
      this.activeVisitors.delete(cleanVisitorId);

      const existing = this.activeUsers.get(params.user.id);
      if (existing) {
        existing.visitorIds.add(cleanVisitorId);
        existing.currentPath = cleanPath;
        existing.lastSeenAt = now;
        existing.fullName = profile.fullName;
        existing.roles = profile.roles;
        existing.primaryRole = profile.primaryRole;
        if (existing.sockets.size === 0) existing.channel = 'HTTP';
      } else {
        this.activeUsers.set(params.user.id, {
          userId: params.user.id,
          fullName: profile.fullName,
          email: profile.email,
          roles: profile.roles,
          primaryRole: profile.primaryRole,
          sockets: new Set(),
          visitorIds: new Set([cleanVisitorId]),
          currentPath: cleanPath,
          connectedSince: new Date(now).toISOString(),
          lastSeenAt: now,
          channel: 'HTTP',
        });
      }
      this.recentlyOffline.delete(params.user.id);
      this.lastSeenAt.set(params.user.id, now);
      return { userId: params.user.id, isOnline: true, lastSeenAt: new Date(now).toISOString() };
    }

    const existingVisitor = this.activeVisitors.get(cleanVisitorId);
    const uaSummary = summarizeUserAgent(params.userAgent);
    if (existingVisitor) {
      if (existingVisitor.currentPath !== cleanPath) {
        existingVisitor.pageViews += 1;
      }
      existingVisitor.currentPath = cleanPath;
      existingVisitor.lastSeenAt = now;
      if (uaSummary !== 'Navigateur Web') existingVisitor.userAgentSummary = uaSummary;
    } else {
      this.activeVisitors.set(cleanVisitorId, {
        visitorId: cleanVisitorId,
        currentPath: cleanPath,
        userAgentSummary: uaSummary,
        startedAt: new Date(now).toISOString(),
        lastSeenAt: now,
        pageViews: 1,
      });
    }

    return { isOnline: true, lastSeenAt: new Date(now).toISOString() };
  }

  recordLeave(params: { userId?: string | null; visitorId?: string }) {
    const cleanVisitorId = params.visitorId?.trim().slice(0, 64);
    if (cleanVisitorId) {
      this.activeVisitors.delete(cleanVisitorId);
    }

    const now = Date.now();
    for (const [userId, session] of this.activeUsers.entries()) {
      const matchesUser = Boolean(params.userId && userId === params.userId);
      const matchesVisitor = Boolean(cleanVisitorId && session.visitorIds.has(cleanVisitorId));
      if (!matchesUser && !matchesVisitor) continue;

      if (cleanVisitorId) session.visitorIds.delete(cleanVisitorId);
      if (session.sockets.size === 0 && (session.visitorIds.size === 0 || matchesUser)) {
        this.activeUsers.delete(userId);
        this.lastSeenAt.set(userId, now);
        this.recentlyOffline.set(userId, {
          userId,
          fullName: session.fullName,
          primaryRole: session.primaryRole,
          lastSeenAt: now,
        });
        return { userId, isOnline: false, lastSeenAt: new Date(now).toISOString() };
      }
    }
    return null;
  }

  updateSocketPath(socketId: string, currentPath?: string) {
    const path = sanitizePath(currentPath);
    const now = Date.now();
    const userId = this.socketToUser.get(socketId);
    if (userId) {
      const s = this.activeUsers.get(userId);
      if (s) {
        s.currentPath = path;
        s.lastSeenAt = now;
        this.lastSeenAt.set(userId, now);
      }
      return;
    }
    const visitorId = this.socketToVisitor.get(socketId);
    if (visitorId) {
      const v = this.activeVisitors.get(visitorId);
      if (v) {
        if (v.currentPath !== path) v.pageViews += 1;
        v.currentPath = path;
        v.lastSeenAt = now;
      }
    }
  }

  isUserOnline(userId: string): boolean {
    this.pruneExpired();
    return this.activeUsers.has(userId);
  }

  getUserStatus(userId: string): UserPresenceStatus {
    this.pruneExpired();
    const active = this.activeUsers.get(userId);
    if (active) {
      return { isOnline: true, lastSeenAt: new Date(active.lastSeenAt).toISOString() };
    }
    const last = this.lastSeenAt.get(userId);
    return {
      isOnline: false,
      lastSeenAt: last ? new Date(last).toISOString() : null,
    };
  }

  /**
   * Privacy-safe lookup: exposes ONLY { isOnline, lastSeenAt } for specific userIds.
   * Never exposes emails, roles, or visited URLs to non-admin callers.
   */
  getUsersPresence(userIds: string[]): Record<string, UserPresenceStatus> {
    this.pruneExpired();
    const result: Record<string, UserPresenceStatus> = {};
    for (const rawId of userIds.slice(0, 50)) {
      const id = rawId.trim();
      if (!id) continue;
      result[id] = this.getUserStatus(id);
    }
    return result;
  }

  /**
   * Admin-only live presence & visitor supervision snapshot.
   */
  getAdminLiveSnapshot() {
    this.pruneExpired();

    const connectedUsers = Array.from(this.activeUsers.values())
      .map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        roles: u.roles,
        primaryRole: u.primaryRole,
        currentPath: u.currentPath,
        channel: u.channel,
        connectedSince: u.connectedSince,
        lastSeenAt: new Date(u.lastSeenAt).toISOString(),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    const visitors = Array.from(this.activeVisitors.values())
      .map((v) => ({
        visitorId: v.visitorId,
        currentPath: v.currentPath,
        userAgentSummary: v.userAgentSummary,
        startedAt: v.startedAt,
        lastSeenAt: new Date(v.lastSeenAt).toISOString(),
        pageViews: v.pageViews,
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    const recentlyOffline = Array.from(this.recentlyOffline.values())
      .filter((r) => !this.activeUsers.has(r.userId))
      .map((r) => ({
        userId: r.userId,
        fullName: r.fullName,
        primaryRole: r.primaryRole,
        lastSeenAt: new Date(r.lastSeenAt).toISOString(),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    const vendorsOnlineCount = connectedUsers.filter(
      (u) => u.roles.includes('VENDOR_OWNER') || u.roles.includes('VENDOR_STAFF'),
    ).length;
    const driversOnlineCount = connectedUsers.filter((u) =>
      u.roles.includes('DELIVERY_AGENT'),
    ).length;
    const customersOnlineCount = connectedUsers.filter((u) =>
      u.roles.includes('CUSTOMER'),
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalActive: connectedUsers.length + visitors.length,
        authenticatedCount: connectedUsers.length,
        visitorsCount: visitors.length,
        vendorsOnlineCount,
        driversOnlineCount,
        customersOnlineCount,
      },
      connectedUsers,
      visitors,
      recentlyOffline,
    };
  }
}
