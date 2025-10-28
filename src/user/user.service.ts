import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll() {
    return await this.userRepository.find();
  }

  async fineByEmail(email: string) {
    return await this.userRepository.findOne({ where: { email } });
  }

  async validateUser(email: string, password: string) {
    const user = await this.fineByEmail(email);

    if (!user) {
      return null;
    }

    const status = await bcrypt.compare(password, user.password);
    if (status) {
      return user;
    }

    return null;
  }

  // async create(data: CreateUserDto): Promise<Users> {
  //   const existingUser = await this.fineByEmail(data.email);

  //   // 🔹 Kiểm tra Email có trong cơ sở dữ liệu không?
  //   if (existingUser) {
  //     throw new BadRequestException('Email already exists');
  //   }

  //   // 🔹 Hash mật khẩu trước khi lưu
  //   const salt = await bcrypt.genSalt(10);
  //   const hashedPassword = await bcrypt.hash(data.password, salt);

  //   const user = this.userRepository.create({
  //     ...data,
  //     password: hashedPassword,
  //   });
  //   return this.userRepository.save(user);
  // }
}
