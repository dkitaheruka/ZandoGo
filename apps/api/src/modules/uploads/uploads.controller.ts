import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsIn, Matches } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UPLOAD_PURPOSES, PresignUploadDto, UploadPurpose } from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';

class LocalUploadDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  @Matches(/^(kyc|chat)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/)
  key: string;
}

interface LocalUploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
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
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) {
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

  @Get('local/chat/:userId/:fileName')
  async readLocalChatImage(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(userId, fileName, expires, signature, 'chat');
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': 'sandbox',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }

  @Get('local/:userId/:fileName')
  async readLocal(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.uploadsService.readLocal(userId, fileName, expires, signature, 'kyc');
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': 'sandbox',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: 'inline',
    });
  }
}
