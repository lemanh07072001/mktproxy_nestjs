import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'users' }) // ⚠ map đúng tên bảng
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  email_verified_at: Date;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  password: string;

  @Column()
  remember_token: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  sodu: number;

  @Column({ nullable: true })
  affiliate_balance: number;

  @Column({ nullable: true })
  affiliate_spent: number;

  @Column({ nullable: true })
  sotiennap: number;

  @Column({ nullable: true })
  affiliate_percent: number;

  @Column({ nullable: true })
  affiliate_code: number;

  @Column({ nullable: true })
  chitieu: number;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  role: number;

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
