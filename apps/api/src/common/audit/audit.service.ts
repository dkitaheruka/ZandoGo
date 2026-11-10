import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditEvent {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  const serialized = JSON.stringify(value);
  if (serialized === undefined) return undefined;
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEvent) {
    const beforeState = toJsonValue(event.beforeState);
    const afterState = toJsonValue(event.afterState);

    return this.prisma.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        ...(beforeState !== undefined ? { beforeState } : {}),
        ...(afterState !== undefined ? { afterState } : {}),
      },
    });
  }
}
