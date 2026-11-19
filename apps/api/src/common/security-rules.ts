export type GatewayPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

const WEAK_SECRET_PATTERNS = [
  'changeme',
  'change-me',
  'default',
  'secret',
  'password',
  '123456',
  'zandogo-dev',
  'test-secret',
];

export function validateJwtSecretsConfig(params: {
  accessSecret?: string;
  refreshSecret?: string;
  isProduction: boolean;
}): void {
  const access = (params.accessSecret ?? '').trim();
  const refresh = (params.refreshSecret ?? '').trim();

  if (!access || !refresh) {
    throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être configurés.');
  }

  if (access === refresh) {
    throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être distincts.');
  }

  if (params.isProduction) {
    if (access.length < 32 || refresh.length < 32) {
      throw new Error(
        'En production, JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent contenir au moins 32 caractères.',
      );
    }
    const lowerAccess = access.toLowerCase();
    const lowerRefresh = refresh.toLowerCase();
    if (WEAK_SECRET_PATTERNS.some((p) => lowerAccess.includes(p) || lowerRefresh.includes(p))) {
      throw new Error(
        'En production, JWT_ACCESS_SECRET et JWT_REFRESH_SECRET ne peuvent pas contenir de valeur par défaut.',
      );
    }
  }
}

export function parseAllowedCorsOrigins(rawAppUrl?: string, isProduction = false): string[] {
  const candidates = (rawAppUrl ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const valid = candidates.filter((origin) => {
    try {
      const parsed = new URL(origin);
      if (isProduction) {
        return parsed.protocol === 'https:';
      }
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  });

  if (valid.length > 0) return valid;
  if (isProduction) return [];
  return ['http://localhost:5173', 'http://localhost:3000'];
}

export function shouldConfirmGatewayPayment(params: {
  isProduction: boolean;
  hasLiveCredentials: boolean;
  signatureVerified: boolean;
  liveCheckVerified: boolean;
  livePaymentStatus: GatewayPaymentStatus;
  declaredSuccess: boolean;
}): boolean {
  if (!params.signatureVerified) {
    return false;
  }

  if (params.liveCheckVerified) {
    return params.livePaymentStatus === 'SUCCESS';
  }

  if (params.hasLiveCredentials) {
    // Fail-closed : avec des identifiants live configurés, si l'API /check échoue ou est injoignable,
    // on ne confirme jamais le paiement sur la seule base d'un payload entrant.
    return false;
  }

  if (params.isProduction) {
    // Fail-closed en production : aucun mode simulateur/non-vérifié accepté.
    return false;
  }

  return params.declaredSuccess;
}

export function isSafePaymentRedirectUrl(url: string | undefined, isProduction: boolean): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (
      !isProduction &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function hasValidFileMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimetype === 'application/pdf') {
    return (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    );
  }

  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  if (mimetype === 'video/mp4' || mimetype === 'video/quicktime') {
    return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }

  if (mimetype === 'video/webm') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }

  return false;
}

export function isSafeChatAttachmentUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 7_000_000) return false;
  if (/^chat\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(trimmed)) {
    return true;
  }
  if (/^\/api\/uploads\/local\/chat\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)(\?.*)?$/.test(trimmed)) {
    return true;
  }
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface AttemptEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

export class LoginAttemptTracker {
  private readonly entries = new Map<string, AttemptEntry>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly lockDurationMs = 15 * 60 * 1000,
    private readonly maxTrackedAccounts = 10_000,
  ) {}

  private pruneIfNeeded(now: number) {
    if (this.entries.size < this.maxTrackedAccounts) return;
    for (const [key, entry] of this.entries.entries()) {
      if (entry.lockedUntil <= now && now - entry.firstFailureAt > this.windowMs) {
        this.entries.delete(key);
      }
    }
    if (this.entries.size >= this.maxTrackedAccounts) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
  }

  isLocked(identifier: string, now = Date.now()): { locked: boolean; retryAfterSeconds: number } {
    const key = identifier.trim().toLowerCase();
    if (!key) return { locked: false, retryAfterSeconds: 0 };
    const entry = this.entries.get(key);
    if (!entry) return { locked: false, retryAfterSeconds: 0 };
    if (entry.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
      };
    }
    if (now - entry.firstFailureAt > this.windowMs) {
      this.entries.delete(key);
    }
    return { locked: false, retryAfterSeconds: 0 };
  }

  recordFailure(
    identifier: string,
    now = Date.now(),
  ): { locked: boolean; attemptsRemaining: number; retryAfterSeconds: number } {
    const key = identifier.trim().toLowerCase();
    if (!key) return { locked: false, attemptsRemaining: this.maxAttempts, retryAfterSeconds: 0 };

    this.pruneIfNeeded(now);
    const existing = this.entries.get(key);
    let entry: AttemptEntry;

    if (!existing || (existing.lockedUntil <= now && now - existing.firstFailureAt > this.windowMs)) {
      entry = { failures: 1, firstFailureAt: now, lockedUntil: 0 };
    } else {
      entry = {
        failures: existing.failures + 1,
        firstFailureAt: existing.firstFailureAt,
        lockedUntil: existing.lockedUntil,
      };
    }

    if (entry.failures >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockDurationMs;
      this.entries.set(key, entry);
      return {
        locked: true,
        attemptsRemaining: 0,
        retryAfterSeconds: Math.ceil(this.lockDurationMs / 1000),
      };
    }

    this.entries.set(key, entry);
    return {
      locked: false,
      attemptsRemaining: Math.max(0, this.maxAttempts - entry.failures),
      retryAfterSeconds: 0,
    };
  }

  recordSuccess(identifier: string): void {
    const key = identifier.trim().toLowerCase();
    if (key) {
      this.entries.delete(key);
    }
  }
}
