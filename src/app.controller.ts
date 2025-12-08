import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('redis-test')
  async testRedis() {
    try {
      await this.cacheManager.set('test_key', 'hello_redis', 100);

      const value = await this.cacheManager.get('test_key');

      return {
        redis_ok: true,
        value,
      };
    } catch (e) {
      return {
        redis_ok: false,
        error: e.message,
      };
    }
  }
}
