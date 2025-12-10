import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { ProxyModule } from './proxy/proxy.module';
import { ApikeyModule } from './apikey/apikey.module';
import { UserModule } from './user/user.module';
import { TypeServicesModule } from './type_services/type_services.module';
import { PartnersModule } from './partners/partners.module';
import { AuthModule } from './auth/auth.module';
import { OrderModule } from './order/order.module';

import config from './config/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),

    // 🧠 MySQL
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'mysql',
        host: configService.get<string>('mysql.host'),
        port: configService.get<number>('mysql.port'),
        username: configService.get<string>('mysql.username'),
        password: configService.get<string>('mysql.password'),
        database: configService.get<string>('mysql.database'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),

    // 🧠 MongoDB
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ): MongooseModuleFactoryOptions => ({
        uri: configService.get<string>('mongodb.uri')!,
      }),
    }),

    // 🧠 Redis
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redis = configService.get('redis') as {
          host: string;
          port: number;
          password: string;
          ttl: number;
          db: number;
        };
        return {
          store: await redisStore({
            socket: {
              host: redis.host,
              port: redis.port,
            },
            password: redis.password || undefined,
            database: redis.db,
          }),
          ttl: redis.ttl,
        };
      },
    }),

    ProxyModule,
    ApikeyModule,
    UserModule,
    TypeServicesModule,
    PartnersModule,
    AuthModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
