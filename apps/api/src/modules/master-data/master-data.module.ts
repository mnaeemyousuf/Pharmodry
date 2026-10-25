import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { FilterQueryDto } from '../../common/pagination';
import {
  BomDto,
  CalibrationDto,
  EquipmentDto,
  MaterialDto,
  ProductDto,
  RoutingDto,
  SpecificationDto,
  TestMethodDto,
  UpdateMaterialDto,
  UpdateProductDto,
} from './master-data.dto';
import { MasterDataService } from './master-data.service';

@ApiTags('master data')
@ApiBearerAuth()
@Controller()
export class MasterDataController {
  constructor(private readonly svc: MasterDataService) {}

  @Get('master-data/lookups')
  lookups() {
    return this.svc.lookups();
  }

  @Get('master-data/versions/:entityType/:entityId')
  @RequirePermissions('masterdata.view')
  versions(@Param('entityType') t: string, @Param('entityId', ParseUUIDPipe) id: string) {
    return this.svc.versions(t, id);
  }

  @Get('products')
  @RequirePermissions('masterdata.view')
  products(@Query() q: FilterQueryDto) {
    return this.svc.listProducts(q);
  }

  @Get('products/:id')
  @RequirePermissions('masterdata.view')
  product(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getProduct(id);
  }

  @Post('products')
  @RequirePermissions('product.manage')
  createProduct(@CurrentUser() u: AuthPrincipal, @Body() dto: ProductDto) {
    return this.svc.createProduct(u, dto);
  }

  @Patch('products/:id')
  @RequirePermissions('product.manage')
  updateProduct(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.svc.updateProduct(u, id, dto);
  }

  @Post('products/:id/boms')
  @RequirePermissions('product.manage')
  createBom(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BomDto) {
    return this.svc.createBom(u, id, dto);
  }

  @Post('products/:id/routings')
  @RequirePermissions('product.manage')
  createRouting(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoutingDto) {
    return this.svc.createRouting(u, id, dto);
  }

  @Get('materials')
  @RequirePermissions('masterdata.view')
  materials(@Query() q: FilterQueryDto) {
    return this.svc.listMaterials(q);
  }

  @Get('materials/:id')
  @RequirePermissions('masterdata.view')
  material(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getMaterial(id);
  }

  @Post('materials')
  @RequirePermissions('material.manage')
  createMaterial(@CurrentUser() u: AuthPrincipal, @Body() dto: MaterialDto) {
    return this.svc.createMaterial(u, dto);
  }

  @Patch('materials/:id')
  @RequirePermissions('material.manage')
  updateMaterial(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaterialDto) {
    return this.svc.updateMaterial(u, id, dto);
  }

  @Get('equipment')
  @RequirePermissions('masterdata.view')
  equipment(@Query() q: FilterQueryDto) {
    return this.svc.listEquipment(q);
  }

  @Get('equipment/:id')
  @RequirePermissions('masterdata.view')
  equipmentOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getEquipment(id);
  }

  @Post('equipment')
  @RequirePermissions('equipment.manage')
  createEquipment(@CurrentUser() u: AuthPrincipal, @Body() dto: EquipmentDto) {
    return this.svc.createEquipment(u, dto);
  }

  @Post('equipment/:id/calibrations')
  @RequirePermissions('equipment.manage')
  calibrate(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CalibrationDto) {
    return this.svc.recordCalibration(u, id, dto);
  }

  @Get('specifications')
  @RequirePermissions('masterdata.view')
  specs(@Query('materialId') materialId?: string, @Query('productId') productId?: string) {
    return this.svc.listSpecs(materialId, productId);
  }

  @Get('specifications/:id')
  @RequirePermissions('masterdata.view')
  spec(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getSpec(id);
  }

  @Post('specifications')
  @RequirePermissions('spec.manage')
  createSpec(@CurrentUser() u: AuthPrincipal, @Body() dto: SpecificationDto) {
    return this.svc.createSpec(u, dto);
  }

  @Post('test-methods')
  @RequirePermissions('spec.manage')
  createTestMethod(@CurrentUser() u: AuthPrincipal, @Body() dto: TestMethodDto) {
    return this.svc.createTestMethod(u, dto);
  }
}

@Module({ controllers: [MasterDataController], providers: [MasterDataService], exports: [MasterDataService] })
export class MasterDataModule {}
