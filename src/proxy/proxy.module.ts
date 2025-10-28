import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyController } from './proxy.controller';
import { ApikeyModule } from 'src/apikey/apikey.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [ProxyController],
  providers: [ProxyService],
  imports: [ApikeyModule, AuthModule],
})
export class ProxyModule {}
