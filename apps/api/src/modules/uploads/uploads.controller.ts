import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsIn, Matches } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { PresignUploadDto, UPLOAD_PURPOSES, UploadPurpose } from './dto/presign-upload.dto';
import { PublicUploadFolder, UploadsService } from './uploads.service';

class LocalUploadDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  @Matches(
    /^(kyc|chat|products|products-videos|disputes|delivery-proofs)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf|mp4|webm|mov)$/,
  )
  key: string;
}

interface LocalUploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const ALLOWED_LOCAL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

function applyPrivateSecurityHeaders(response: Response) {
  response.set({
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': 'sandbox',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
}

/**
 * Routes de lecture média locales pour balises <img> / <video> :
 * - les médias privés (chat, litiges, preuves livraison) exigent une signature HMAC temporaire ;
 * - les médias catalogue publics ne sont servis qu'en mode développement local.
 */
@Controller('uploads/local')
export class LocalUploadsMediaController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('public/:folder/:userId/:fileName')
  async readLocalPublicMedia(
    @Param('folder') folder: string,
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (folder !== 'products' && folder !== 'products-videos') {
      throw new BadRequestException('Dossier média non autorisé');
    }
    const media = await this.uploadsService.readLocalPublic(
      folder as PublicUploadFolder,
      userId,
      fileName,
    );
    response.set({
      'Cache-Control': 'public, max-age=300',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(media.buffer, {
      type: media.contentType,
      disposition: 'inline',
    });
  }

  @Get('chat/:userId/:fileName')
  async readLocalChatImage(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(userId, fileName, expires, signature, 'chat');
    applyPrivateSecurityHeaders(response);
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }

  @Get('disputes/:userId/:fileName')
  async readLocalDisputeEvidence(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(userId, fileName, expires, signature, 'disputes');
    applyPrivateSecurityHeaders(response);
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }

  @Get('delivery-proofs/:userId/:fileName')
  async readLocalDeliveryProof(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(
      userId,
      fileName,
      expires,
      signature,
      'delivery-proofs',
    );
    applyPrivateSecurityHeaders(response);
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }
}

@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // Limité par client : chaque appel crée une autorisation d'écriture dans notre stockage.
  // Ne s'applique que grâce à ThrottlerGuard ci-dessus (le décorateur seul ne limite rien).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('presign')
  presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignUploadDto) {
    return this.uploadsService.presign(user, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('local')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_LOCAL_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException('Type de fichier non accepté'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadLocal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LocalUploadDto,
    @UploadedFile() file: LocalUploadedFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Choisissez un document à envoyer');
    return { key: await this.uploadsService.storeLocal(user, dto.purpose, dto.key, file) };
  }

  @Get('local/:userId/:fileName')
  async readLocalKyc(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(userId, fileName, expires, signature, 'kyc');
    applyPrivateSecurityHeaders(response);
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }
}
