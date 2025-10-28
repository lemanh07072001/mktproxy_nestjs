import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { ApikeyController } from './apikey.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apikey } from './entities/apikey.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Apikey]), AuthModule],
  controllers: [ApikeyController],
  providers: [ApikeyService],
  exports: [ApikeyService],
})
export class ApikeyModule {}
