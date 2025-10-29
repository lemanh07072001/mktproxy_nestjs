import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProxyService } from './proxy.service';
import { ProxyController } from './proxy.controller';
import { ApikeyModule } from 'src/apikey/apikey.module';
import { Proxy, ProxySchema } from './schemas/proxy.schema';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [ProxyController],
  providers: [ProxyService],
  imports: [ApikeyModule, AuthModule,  MongooseModule.forFeature([
    { name: Proxy.name, schema: ProxySchema },
  ]),],
})
export class ProxyModule {}
