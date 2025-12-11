import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProxyService } from './proxy.service';
import { ProxyController } from './proxy.controller';
import { ApikeyModule } from 'src/apikey/apikey.module';
import { Proxy, ProxySchema } from './schemas/proxy.schema';
import { ProxyKey, ProxyKeySchema } from './schemas/proxy-key.schema';
import { AuthModule } from 'src/auth/auth.module';
import { HomeproxyService } from './services/homeproxy.service';
import { ProxyvnService } from './services/proxyvn.service';
import { MktproxyService } from './services/mktproxy.service';

@Module({
  controllers: [ProxyController],
  providers: [
    ProxyService,
    HomeproxyService,
    ProxyvnService,
    MktproxyService,
  ],
  imports: [
    ApikeyModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: Proxy.name, schema: ProxySchema },
      { name: ProxyKey.name, schema: ProxyKeySchema },
    ]),
  ],
})
export class ProxyModule {}
