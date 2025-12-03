import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { TypeService } from '../../type_services/entities/type_service.entity';
import { Apikey } from '../../apikey/entities/apikey.entity';

@Entity({ name: 'orders' }) // ⚠ map đúng tên bảng
@Unique('orders_order_code_unique', ['order_code'])
@Index('orders_user_id_index', ['user_id'])
@Index('orders_type_service_id_index', ['type_service_id'])
@Index('orders_status_index', ['status'])
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column()
  user_id: number;

  @Column()
  type_service_id: number;

  @Column({ type: 'varchar', length: 20 })
  order_code: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_per_unit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_amount: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0, comment: 'Số lượng scan' })
  scan: number;

  @Column({ type: 'int', default: 0, comment: 'Số lần retry khi gọi API thất bại' })
  retry: number;

  @Column({ type: 'int', nullable: true })
  time: number;

  @Column({ type: 'int', default: 1 })
  days_remaining: number;

  @Column({ type: 'varchar', length: 191, nullable: true })
  proxy_type: string;

  @Column({ type: 'timestamp', nullable: true })
  buy_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP', // ✅ tự động cập nhật khi update record
  })
  updated_at: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0.00, comment: 'Tổng giá gốc' })
  total_cost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0.00, comment: 'Giá gốc / đơn giá vốn' })
  cost_price: number;

  // ✅ Liên kết với User
  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // ✅ Liên kết với TypeService
  @ManyToOne(() => TypeService, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'type_service_id' })
  type_service?: TypeService;

  // ✅ Liên kết với Apikey (một Order có nhiều Apikey)
  @OneToMany(() => Apikey, (apikey) => apikey.order)
  api_keys?: Apikey[];
}

