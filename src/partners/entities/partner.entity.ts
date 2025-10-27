import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { PartnersStatus } from '../enum/partners.enum';

@Entity({ name: 'partners' }) // ⚠ map đúng tên bảng
export class Partners {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  partner_code: string;

  @Column({ nullable: true })
  token_api: string;

  @Column({
    type: 'enum',
    enum: PartnersStatus,
    nullable: true,
    default: PartnersStatus.ACTIVE,
  })
  status: PartnersStatus;

  @Column({ nullable: true, type: 'json' })
  note: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  order: number;

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
}
