import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partners } from './entities/partner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Partners])],
  controllers: [PartnersController],
  providers: [PartnersService],
})
export class PartnersModule {}
