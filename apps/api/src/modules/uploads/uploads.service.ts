import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAbsolute, relative, resolve, sep } from 'path';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PresignUploadDto, UploadPurpose } from './dto/presign-upload.dto';

const URL_TTL_SECONDS = 300; // 5 minutes : assez pour un envoi, trop court pour être réutilisé
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const KYC_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

interface LocalUploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

interface PurposeRule {
  folder: string;
  bucket: 'private' | 'public';
  /** type MIME autorisé -> extension imposée (jamais celle fournie par le client) */
  types: Record<string, string>;
  roles?: RoleName[]; // si défini, un de ces rôles est requis
}

const RULES: Record<UploadPurpose, PurposeRule> = {
  // Pièces d'identité : espace privé, jamais lisible publiquement
  KYC_DOCUMENT: {
    folder: 'kyc',
    bucket: 'private',
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' },
  },
  // Images produit : espace public (affichées dans le catalogue). Pas de SVG : il peut contenir du code.
  PRODUCT_IMAGE: {
    folder: 'products',
    bucket: 'public',
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    roles: [RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF],
  },
};

@Injectable()
export class UploadsService {
  private client: S3Client | null = null;
  private readonly localStorageEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const driver = config.get<string>('UPLOADS_DRIVER') ?? 's3';
    if (driver !== 's3' && driver !== 'local') {
      throw new Error('UPLOADS_DRIVER must be either "s3" or "local"');
    }
    if (driver === 'local' && config.get<string>('NODE_ENV') !== 'development') {
      throw new Error('Local file storage is only allowed in development');
    }
    this.localStorageEnabled = driver === 'local';
  }

  private localStoragePath(): string {
    const configuredPath = this.config.get<string>('UPLOADS_LOCAL_DIR') || 'uploads';
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(__dirname, '../../../', configuredPath);
  }

  /** Créé à la demande : l'application démarre même si le stockage n'est pas encore configuré (dev) */
  private getClient(): S3Client {
    if (this.client) return this.client;

    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    if (!accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException("Le stockage de fichiers n'est pas configuré");
    }

    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      forcePathStyle: true, // requis par la plupart des stockages S3-compatibles (B2, Spaces, MinIO)
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  private bucketFor(kind: 'private' | 'public'): string {
    const name = this.config.get<string>(kind === 'private' ? 'S3_PRIVATE_BUCKET' : 'S3_PUBLIC_BUCKET');
    if (!name) throw new ServiceUnavailableException("Le stockage de fichiers n'est pas configuré");
    return name;
  }

  /**
   * Délivre une URL de dépôt à usage unique. Le fichier est envoyé directement du
   * navigateur au stockage : il ne transite jamais par ce serveur.
   */
  async presign(user: AuthenticatedUser, dto: PresignUploadDto) {
    const rule = RULES[dto.purpose];

    if (rule.roles && !user.roles.some((r) => rule.roles!.includes(r.role as RoleName))) {
      throw new ForbiddenException("Vous n'avez pas le droit d'envoyer ce type de fichier");
    }

    const extension = rule.types[dto.contentType];
    if (!extension) {
      throw new BadRequestException(
        `Type de fichier non accepté. Autorisés : ${Object.keys(rule.types).join(', ')}`,
      );
    }

    // Le nom est entièrement choisi par le serveur : on ignore tout nom fourni par le client
    const key = `${rule.folder}/${user.id}/${randomUUID()}.${extension}`;
    if (this.localStorageEnabled && dto.purpose === 'KYC_DOCUMENT') {
      return { mode: 'local' as const, key };
    }

    const bucket = this.bucketFor(rule.bucket);

    const uploadUrl = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: dto.contentType,
        ContentLength: dto.sizeBytes,
      }),
      {
        expiresIn: URL_TTL_SECONDS,
        // Signés explicitement : le stockage refuse un envoi dont le type ou la taille diffèrent
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );

    return {
      mode: 's3' as const,
      uploadUrl,
      key,
      // En-têtes que le navigateur doit envoyer À L'IDENTIQUE avec la requête PUT
      requiredHeaders: { 'Content-Type': dto.contentType },
      expiresInSeconds: URL_TTL_SECONDS,
    };
  }

  async storeLocal(
    user: AuthenticatedUser,
    purpose: UploadPurpose,
    key: string,
    file: LocalUploadedFile,
  ): Promise<string> {
    if (!this.localStorageEnabled || purpose !== 'KYC_DOCUMENT') {
      throw new ServiceUnavailableException('Le stockage local est réservé aux documents KYC en développement');
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES || file.size !== file.buffer.length) {
      throw new BadRequestException('La taille du fichier est invalide (maximum 5 Mo)');
    }

    const extension = KYC_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Type de fichier non accepté');
    }

    this.assertOwnedKey(user, purpose, key);
    if (!new RegExp(`^kyc/${user.id}/[0-9a-f-]{36}\\.${extension}$`).test(key)) {
      throw new BadRequestException('Clé de fichier invalide');
    }

    const fileName = key.split('/')[2];
    const directory = resolve(this.localStoragePath(), user.id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, fileName), file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });
    return key;
  }

  /**
   * Un utilisateur ne peut rattacher à son dossier (KYC, produit) qu'un fichier qu'il a
   * lui-même envoyé : la clé commence par son propre identifiant. Sans cela, il pourrait
   * référencer le fichier d'un autre utilisateur en devinant sa clé.
   */
  assertOwnedKey(user: AuthenticatedUser, purpose: UploadPurpose, key: string) {
    const prefix = `${RULES[purpose].folder}/${user.id}/`;
    if (!key.startsWith(prefix) || key.includes('..')) {
      throw new ForbiddenException("Ce fichier n'a pas été envoyé par votre compte");
    }
  }

  /** URL publique d'une image produit (espace public uniquement) */
  publicUrlFor(key: string): string {
    const base = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (!base) throw new ServiceUnavailableException("Le stockage de fichiers n'est pas configuré");
    return `${base.replace(/\/+$/, '')}/${key}`;
  }

  /**
   * Lecture d'un document privé (KYC) : URL signée de courte durée, réservée aux appelants
   * que le service métier a déjà autorisés. Refuse toute clé hors du dossier kyc/.
   */
  async signedReadUrl(key: string): Promise<string> {
    if (!key.startsWith(`${RULES.KYC_DOCUMENT.folder}/`) || key.includes('..')) {
      throw new BadRequestException('Clé de fichier invalide');
    }
    if (this.localStorageEnabled) {
      const match = /^kyc\/([0-9a-f-]{36})\/([0-9a-f-]{36}\.(?:jpg|png|pdf))$/.exec(key);
      if (!match) throw new BadRequestException('Clé de fichier invalide');
      const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
      const signature = this.localReadSignature(key, expires);
      return `/api/uploads/local/${match[1]}/${match[2]}?expires=${expires}&signature=${signature}`;
    }

    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucketFor('private'), Key: key }),
      { expiresIn: URL_TTL_SECONDS },
    );
  }

  async readLocal(
    userId: string,
    fileName: string,
    expiresValue: string,
    signature: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.localStorageEnabled) {
      throw new NotFoundException('Document introuvable');
    }

    const key = `kyc/${userId}/${fileName}`;
    if (!/^kyc\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(key)) {
      throw new NotFoundException('Document introuvable');
    }
    const expires = Number(expiresValue);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(expires) || expires <= now || expires > now + URL_TTL_SECONDS) {
      throw new UnauthorizedException('Le lien du document a expiré');
    }

    const expected = Buffer.from(this.localReadSignature(key, expires), 'hex');
    const supplied = Buffer.from(signature ?? '', 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Lien du document invalide');
    }

    const root = this.localStoragePath();
    const filePath = resolve(root, userId, fileName);
    const pathFromRoot = relative(root, filePath);
    if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new NotFoundException('Document introuvable');
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException('Document introuvable');
      }
      throw error;
    }

    const extension = fileName.split('.').pop();
    const contentType =
      extension === 'jpg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : 'application/pdf';
    return { buffer, contentType };
  }

  private localReadSignature(key: string, expires: number): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('JWT_ACCESS_SECRET must be configured for local document storage');
    return createHmac('sha256', secret).update(`${key}.${expires}`).digest('hex');
  }
}
