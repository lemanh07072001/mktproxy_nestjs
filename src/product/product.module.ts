import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Product } from './entity/product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductLog, ProductLogSchema } from './schema/product-log.schema';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    MongooseModule.forFeature([
      { name: ProductLog.name, schema: ProductLogSchema },
    ]),
  ],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
