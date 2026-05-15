import { Module } from '@nestjs/common';
import { PricingGridsController } from './pricing-grids.controller';
import { PricingGridsService } from './pricing-grids.service';

@Module({
  controllers: [PricingGridsController],
  providers: [PricingGridsService],
  exports: [PricingGridsService],
})
export class PricingGridsModule {}
