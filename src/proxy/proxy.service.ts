import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Proxy, ProxyDocument } from './schemas/proxy.schema';
import { ProxyKey, ProxyKeyDocument } from './schemas/proxy-key.schema';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { getRedisClient } from 'src/common/redis';
import {
  lastRotateKey,
  currentKey,
  inUseKey,
  recentKey,
} from 'src/common/key.cache';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';

export interface KeyResponse {
  key: string;
  expired_at: number;
  expired_date: string;
}

@Injectable()
export class ProxyService {
  private redis: Redis;
  private readonly logger = new Logger(ProxyService.name);

  private ROTATE_SECONDS = 60;
  private RECENT_LIMIT = 5;

  constructor(
    @InjectModel(Proxy.name) private proxyModel: Model<ProxyDocument>,
    @InjectModel(ProxyKey.name) private proxyKeyModel: Model<ProxyKeyDocument>,
  ) {
    this.redis = getRedisClient();
  }

  // Validate key trước khi sử dụng
  async validateKey(key: string): Promise<ProxyKeyDocument> {
    const proxyKey = await this.proxyKeyModel.findOne({ key, active: true });

    if (!proxyKey) {
      throw new NotFoundException('Key không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const now = Math.floor(Date.now() / 1000);
    if (proxyKey.expired_at && proxyKey.expired_at < now) {
      throw new BadRequestException('Key đã hết hạn');
    }

    return proxyKey;
  }

  async getProxyForKey(key: string) {
    // Validate key
    await this.validateKey(key);

    const now = Math.floor(Date.now() / 1000);
    const [lastRotate, currentProxy] = await this.redis.mget(
      lastRotateKey(key),
      currentKey(key),
    );

    // Nếu chưa đến thời gian xoay và có proxy hiện tại -> trả về proxy cũ
    if (
      lastRotate &&
      now - Number(lastRotate) < this.ROTATE_SECONDS &&
      currentProxy
    ) {
      const timeElapsed = now - Number(lastRotate);
      const timeRemaining = this.ROTATE_SECONDS - timeElapsed;

      return {
        proxy: JSON.parse(currentProxy),
        reused: true,
        timeRemaining, // Thời gian còn lại (giây)
        nextRotateIn: timeRemaining, // Alias rõ ràng hơn
      };
    }

    // Xoay proxy mới
    return this.rotateProxy(
      key,
      currentProxy ? JSON.parse(currentProxy) : null,
    );
  }

  private async rotateProxy(key: string, oldProxy?: any) {
    // lấy danh sách proxy đang dùng và recent
    const [inuse, recent] = await Promise.all([
      this.redis.smembers(inUseKey),
      this.redis.lrange(recentKey(key), 0, -1),
    ]);
    const exclude = [...inuse, ...recent];

    // tìm 1 proxy ngẫu nhiên không nằm trong exclude
    const newProxy = await this.proxyModel.aggregate([
      { $match: { ip: { $nin: exclude } } },
      { $sample: { size: 1 } },
    ]);

    console.log(newProxy);

    if (!newProxy.length) {
      this.logger.warn(`Không còn proxy khả dụng cho key ${key}`);
      return null;
    }

    const proxy = newProxy[0];

    const proxyStr = `${proxy.ip}:${proxy.port}`;

    const multi = this.redis.multi();

    if (oldProxy) multi.srem(inUseKey, `${oldProxy.ip}:${oldProxy.port}`);

    multi.sadd(inUseKey, proxyStr);
    multi.set(currentKey(key), JSON.stringify(proxy));
    multi.set(lastRotateKey(key), now());
    multi.lpush(recentKey(key), proxyStr);
    multi.ltrim(recentKey(key), 0, this.RECENT_LIMIT - 1);
    multi.expire(recentKey(key), 3600 * 24);
    await multi.exec();

    this.logger.log(`🔄 Xoay proxy cho key ${key} -> ${proxyStr}`);

    return { proxy, reused: false };
  }

  async getAllProxies() {
    return this.proxyModel.find().lean(); // lấy toàn bộ document
  }

  // API mua key (nhiều key cùng lúc)
  async buyKeys(user_id: string, quantity: number = 1, days: number = 30) {
    if (quantity <= 0 || quantity > 100) {
      throw new BadRequestException('Số lượng phải từ 1-100');
    }

    if (days <= 0 || days > 365) {
      throw new BadRequestException('Số ngày phải từ 1-365');
    }

    const expiredAt = dayjs().add(days, 'day').unix(); // timestamp
    const keys: KeyResponse[] = [];

    // Tạo nhiều key
    for (let i = 0; i < quantity; i++) {
      const key = this.generateKey();

      const newKey = await this.proxyKeyModel.create({
        key,
        user_id,
        expired_at: expiredAt,
        active: true,
      });

      keys.push({
        key: newKey.key,
        expired_at: newKey.expired_at,
        expired_date: dayjs
          .unix(newKey.expired_at)
          .format('YYYY-MM-DD HH:mm:ss'),
      });

      this.logger.log(
        `✅ Tạo key ${i + 1}/${quantity}: ${key} cho user ${user_id}`,
      );
    }

    this.logger.log(
      `✅ Hoàn thành tạo ${quantity} key cho user ${user_id}, hết hạn: ${dayjs.unix(expiredAt).format('YYYY-MM-DD HH:mm:ss')}`,
    );

    return keys;
  }

  private generateKey() {
    return randomBytes(16).toString('base64url'); // ví dụ: D8f3Y1MSh4lG7k_tFmwOkg
  }

  async getKeyDetail(key: string) {
    return this.proxyModel.findOne({ key });
  }
}

function now() {
  return Math.floor(Date.now() / 1000);
}
