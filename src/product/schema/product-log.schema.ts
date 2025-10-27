import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'product_logs', timestamps: true })
export class ProductLog extends Document {
  @Prop()
  action: string;

  @Prop()
  productId: number;

  @Prop({ type: Object })
  payload: any;
}

export const ProductLogSchema = SchemaFactory.createForClass(ProductLog);
