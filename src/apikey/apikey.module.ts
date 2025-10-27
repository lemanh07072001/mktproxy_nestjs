import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { ApikeyController } from './apikey.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apikey } from './entities/apikey.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Apikey])],
  controllers: [ApikeyController],
  providers: [ApikeyService],
})
export class ApikeyModule {}
