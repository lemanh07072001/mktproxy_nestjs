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

  async getApiKeyDetails(api_key: string) {
    return this.apiKeyRepository.findOne({
      where: { api_key },
      relations: ['service_type.partner'],
    });
  }

  async updateProxys(key: string, proxyArray: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const apiKey = await this.apiKeyRepository.findOne({
      where: { api_key: key },
    });
    if (!apiKey) return null;

    apiKey.proxys = proxyArray;
    await this.apiKeyRepository.save(apiKey);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return apiKey;
  }
}
