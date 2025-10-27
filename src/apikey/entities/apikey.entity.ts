import { ApiKeyStatus } from '../enum/apikey.enum';

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { TypeService } from '../../type_services/entities/type_service.entity';

@Entity({ name: 'api_keys' }) // ⚠ map đúng tên bảng
export class Apikey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  api_key: string;

  @Column()
  api_key_partner: string;

  @Column()
  user_id: number;

  @Column()
  plan_id: number;

  @Column()
  plan_type: string;

  @Column()
  nb_day: number;

  @Column({ type: 'double' })
  total_price: number;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    nullable: true,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  buy_at: Date;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  expired_at: Date;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  last_time_use: Date;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP', // ✅ tự động cập nhật khi update record
  })
  updated_at: Date;

  // ✅ Liên kết với User
  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // ✅ Liên kết với ServiceType
  @ManyToOne(() => TypeService, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'plan_id' })
  service_type?: TypeService;
}
