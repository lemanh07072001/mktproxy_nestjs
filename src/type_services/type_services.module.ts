import { Module } from '@nestjs/common';
import { TypeServicesService } from './type_services.service';
import { TypeServicesController } from './type_services.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeService } from './entities/type_service.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TypeService])],
  controllers: [TypeServicesController],
  providers: [TypeServicesService],
})
export class TypeServicesModule {}
