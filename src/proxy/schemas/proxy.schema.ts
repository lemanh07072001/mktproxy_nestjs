// src/proxy/schemas/proxy.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'proxies' })
export class Proxy {
  @Prop({ required: true })
  ip: string;

  @Prop({ required: true })
  port: number;

  @Prop()
  user?: string;

  @Prop()
  pass?: string;

  @Prop()
  expired_at: number; // active, banned, expired...
}

export type ProxyDocument = Proxy & Document;
export const ProxySchema = SchemaFactory.createForClass(Proxy);
