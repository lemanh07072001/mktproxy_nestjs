// src/proxy/schemas/proxy-rotation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'proxy_rotations', timestamps: true })
export class ProxyRotation {
  @Prop({ required: true }) key: string;             // api key
  @Prop({ required: true }) proxy: string;           // "ip:port"
  @Prop({ default: () => new Date() }) rotated_at: Date;
  @Prop({ default: 'active' }) status: string;       // active/expired/error
  // KHÔNG cần reused vì chỉ lưu khi đổi proxy
}

export type ProxyRotationDocument = ProxyRotation & Document;
export const ProxyRotationSchema = SchemaFactory.createForClass(ProxyRotation);

// Index tăng tốc truy vấn theo key + thời gian
ProxyRotationSchema.index({ key: 1, rotated_at: -1 });