import { Module } from '@nestjs/common';

import { OrderController } from './order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProxyRotation, ProxyRotationSchema } from './schemas/proxy_rotations.schema';
import { OrderService } from './order.service';


@Module({
  imports: [MongooseModule.forFeature([{ name: ProxyRotation.name, schema: ProxyRotationSchema }])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [MongooseModule]
})
export class OrderModule {}
