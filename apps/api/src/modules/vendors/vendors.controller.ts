import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogService } from '../catalog/catalog.service';
import { CreateProductDto } from '../catalog/dto/create-product.dto';
import { UpdateProductDto } from '../catalog/dto/update-product.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { ReviewStoreDto } from './dto/review-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { VendorsService } from './vendors.service';

@Controller('vendors/stores')
export class VendorsController {
  constructor(
    private readonly vendors: VendorsService,
    private readonly catalog: CatalogService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoreDto) {
    return this.vendors.createStore(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.vendors.getMyStores(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('pending')
  listPending() {
    return this.vendors.listPendingStores();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.vendors.getStoreById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.vendors.updateStore(user, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Patch(':id/review')
  review(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewStoreDto,
  ) {
    return this.vendors.reviewStore(admin, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF)
  @Post(':storeId/products')
  createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalog.createProduct(user, storeId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF)
  @Get(':storeId/products')
  listStoreProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.catalog.listStoreProducts(user, storeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF)
  @Patch(':storeId/products/:productId')
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(user, productId, dto);
  }
}
