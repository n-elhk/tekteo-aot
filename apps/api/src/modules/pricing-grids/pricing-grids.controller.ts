import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createPricingGridSchema,
  updatePricingGridSchema,
  type CreatePricingGridDto,
  type UpdatePricingGridDto,
} from '@org/schemas';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PricingGridsService } from './pricing-grids.service';

@Controller('pricing-grids')
export class PricingGridsController {
  constructor(private readonly pricing: PricingGridsService) {}

  // Lecture pour tous les rôles authentifiés
  @Get()
  findAll() {
    return this.pricing.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pricing.findOne(id);
  }

  // Mutations admin uniquement
  @Post()
  @Roles(['admin'])
  create(
    @Body(new ZodValidationPipe(createPricingGridSchema))
    dto: CreatePricingGridDto,
  ) {
    return this.pricing.create(dto);
  }

  @Patch(':id')
  @Roles(['admin'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePricingGridSchema))
    dto: UpdatePricingGridDto,
  ) {
    return this.pricing.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.pricing.remove(id);
  }
}
