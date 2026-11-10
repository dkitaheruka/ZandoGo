import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { KycStatus, KycType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { UploadsService } from '../uploads/uploads.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsGateway,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * fileKey est la clé renvoyée par POST /uploads/presign : le fichier a déjà été déposé
   * directement dans le bucket PRIVÉ par le navigateur. On vérifie qu'il s'agit bien d'un
   * fichier envoyé par CE compte, sinon on pourrait rattacher le document d'un autre.
   */
  async submitDocument(user: AuthenticatedUser, type: KycType, fileKey: string) {
    this.uploads.assertOwnedKey(user, 'KYC_DOCUMENT', fileKey);

    const pending = await this.prisma.kycDocument.findFirst({
      where: { userId: user.id, type, status: KycStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException('Un document de ce type est déjà en attente de validation');
    }

    const doc = await this.prisma.kycDocument.create({
      data: { userId: user.id, type, fileKey, status: KycStatus.PENDING },
      select: { id: true, type: true, status: true, createdAt: true },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'kyc.submit',
      entityType: 'KycDocument',
      entityId: doc.id,
      afterState: { type },
    });

    return doc;
  }

  async getMyDocuments(user: AuthenticatedUser) {
    // Sélection explicite : la clé de stockage n'a pas à sortir de l'API
    return this.prisma.kycDocument.findMany({
      where: { userId: user.id },
      select: { id: true, type: true, status: true, createdAt: true },
    });
  }

  async listPending() {
    return this.prisma.kycDocument.findMany({
      where: { status: KycStatus.PENDING },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Consulter une pièce d'identité est une opération sensible : URL signée de 5 minutes,
   * et chaque consultation est journalisée (qui, quel document, de qui). Si la journalisation
   * échoue, l'URL n'est pas renvoyée.
   */
  async getDocumentReadUrl(admin: AuthenticatedUser, documentId: string) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      select: { id: true, fileKey: true, userId: true, type: true },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    const url = await this.uploads.signedReadUrl(doc.fileKey);

    await this.audit.log({
      actorUserId: admin.id,
      action: 'kyc.view_document',
      entityType: 'KycDocument',
      entityId: documentId,
      afterState: { ownerUserId: doc.userId, type: doc.type },
    });

    return { url };
  }

  async review(
    admin: AuthenticatedUser,
    documentId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const doc = await this.prisma.kycDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (doc.status !== KycStatus.PENDING) {
      throw new ConflictException('Ce document a déjà été traité');
    }

    const result = await this.prisma.kycDocument.updateMany({
      where: { id: documentId, status: KycStatus.PENDING },
      data: { status, reviewedBy: admin.id, reviewedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ConflictException('Ce document a déjà été traité');
    }

    const updated = await this.prisma.kycDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'kyc.review',
      entityType: 'KycDocument',
      entityId: documentId,
      afterState: { status },
    });

    await this.notifications.notifyUser({
      userId: doc.userId,
      type: 'kyc.status_change',
      title: status === KycStatus.APPROVED ? 'Document approuvé' : 'Document refusé',
      body: `Votre document (${doc.type}) a été ${status === KycStatus.APPROVED ? 'approuvé' : 'refusé'}.`,
      data: { documentId, status },
    });

    return updated;
  }
}
