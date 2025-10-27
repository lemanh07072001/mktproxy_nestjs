import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Apikey } from './entities/apikey.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ApikeyService {
  constructor(
    @InjectRepository(Apikey)
    private readonly apiKeyRepository: Repository<Apikey>,
  ) {}

  async findAll(): Promise<Apikey[]> {
    return this.apiKeyRepository.find({
      relations: ['user', 'service_type'],
    });
  }
}
