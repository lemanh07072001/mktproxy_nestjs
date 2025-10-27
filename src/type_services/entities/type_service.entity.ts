import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TypeServiceStatus, TypeStatus } from '../enum/typeService.enum';
import { Partners } from '../../partners/entities/partner.entity';

@Entity({ name: 'type_services' }) // ⚠ map đúng tên bảng
export class TypeService {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column()
  partner_id: number;

  @Column({ nullable: true })
  api_partner: string;

  @Column({ nullable: true, type: 'decimal' })
  cost_price: string;

  @Column({ nullable: true, type: 'decimal' })
  price: string;

  @Column({ nullable: true })
  image: string;

  @Column({
    type: 'enum',
    enum: TypeServiceStatus,
    nullable: true,
    default: TypeServiceStatus.ACTIVE,
  })
  status: TypeServiceStatus;

  @Column({
    type: 'enum',
    enum: TypeStatus,
    nullable: true,
    default: TypeStatus.STATIC,
  })
  TYPE: TypeStatus;

  @Column({ nullable: true, type: 'json' })
  api_body: string;

  @Column({ nullable: true })
  api_type: string;

  @Column({ nullable: true })
  ip_version: string;

  @Column({ nullable: true })
  time_type: string;

  @Column({ nullable: true })
  show_time: number;

  @Column({ nullable: true })
  allow_user: number;

  @Column({ nullable: true, type: 'json' })
  date_mapping: string;

  @Column({ nullable: true })
  protocol_type: number;

  @Column({ nullable: true })
  note: string;

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

  // ✅ Liên kết với ServiceType
  @ManyToOne(() => Partners, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'partner_id' })
  partner?: Partners;
}
