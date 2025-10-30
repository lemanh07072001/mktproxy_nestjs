// src/proxy/schemas/proxy-key.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'proxy_keys', timestamps: true })
export class ProxyKey {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: false })
  user_id?: string;

  @Prop({ required: true })
  expired_at: number; // timestamp Unix

  @Prop({ default: true })
  active: boolean;

  @Prop()
  current_proxy_host?: string; // host của proxy hiện tại đang sử dụng

  @Prop()
  last_rotate_at?: number; // timestamp lần xoay gần nhất
}

export type ProxyKeyDocument = ProxyKey & Document;
export const ProxyKeySchema = SchemaFactory.createForClass(ProxyKey);
