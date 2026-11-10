import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsIn, Matches } from 'class-validator';
import { KycStatus, KycType, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { KycService } from './kyc.service';

class SubmitKycDto {
  @IsEnum(KycType)
  type: KycType;

  // Format strict de la clé générée par POST /uploads/presign : kyc/<userId>/<uuid>.<ext>
  // Rejette d'emblée une URL, un chemin relatif ou une tentative de traversée de dossier.
  @Matches(/^kyc\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/, {
    message: 'Clé de fichier invalide : envoyez le fichier via /uploads/presign',
  })
  fileKey: string;
}

class ReviewKycDto {
  @IsIn([KycStatus.APPROVED, KycStatus.REJECTED])
  status: 'APPROVED' | 'REJECTED';
}

@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('documents')
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitKycDto) {
    return this.kycService.submitDocument(user, dto.type, dto.fileKey);
  }

  @Get('documents/mine')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getMyDocuments(user);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Get('documents/pending')
  listPending() {
    return this.kycService.listPending();
  }

  /** URL signée de 5 minutes pour consulter un document privé — admin uniquement, journalisé */
  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Get('documents/:id/file-url')
  getFileUrl(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.kycService.getDocumentReadUrl(admin, id);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Patch('documents/:id/review')
  review(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.review(admin, id, dto.status);
  }
}
