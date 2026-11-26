import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CatalogService } from './catalog.service';

@Controller('downloads')
export class DownloadsController {
  constructor(private readonly catalog: CatalogService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':productId/:orderId')
  async downloadDigitalProduct(
    @Param('productId') productId: string,
    @Param('orderId') orderId: string,
    @Query('token') token: string | undefined,
    @CurrentUser() user: AuthenticatedUser | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { buffer, fileName } = await this.catalog.getDigitalDownloadFile(
      productId,
      orderId,
      user,
      token,
    );

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safeFileName}"`,
    });
  }
}
