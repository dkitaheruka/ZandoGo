import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { SetCommissionRuleDto } from './dto/set-commission-rule.dto';

class ProductQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MaxLength(1500)
  comment: string;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN, RoleName.VENDOR_OWNER)
  @Post('categories')
  createCategory(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(admin, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Post('categories/commission-rules')
  setCommissionRule(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SetCommissionRuleDto) {
    return this.catalog.setCommissionRule(admin, dto);
  }

  @Get('products')
  listProducts(@Query() query: ProductQuery) {
    return this.catalog.listProducts(query);
  }

  @Get('products/sponsored')
  listSponsoredProducts() {
    return this.catalog.listSponsoredProducts();
  }

  @Get('products/:id/reviews')
  listReviews(@Param('id') id: string) {
    return this.catalog.listProductReviews(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/:id/reviews')
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.catalog.addProductReview(user, id, dto.rating, dto.comment);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('products/:id')
  getProduct(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser | null) {
    return this.catalog.getProduct(id, user ?? undefined);
  }
}
