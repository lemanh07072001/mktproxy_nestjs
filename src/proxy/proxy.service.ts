import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Proxy, ProxyDocument } from './schemas/proxy.schema';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { getRedisClient } from 'src/common/redis';
import { lastRotateKey, currentKey, inUseKey, recentKey } from 'src/common/key.cache';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';


@Injectable()
export class ProxyService {
  private redis: Redis;
  private readonly logger = new Logger(ProxyService.name);

  private ROTATE_SECONDS = 60;
  private RECENT_LIMIT = 5;

  constructor(
    @InjectModel(Proxy.name) private proxyModel: Model<ProxyDocument>,

  ) {
    this.redis = getRedisClient();
}

  async getProxyForKey(key: string) {
    const now = Math.floor(Date.now() / 1000);
    const [lastRotate, currentProxy] = await this.redis.mget(
      lastRotateKey(key),
      currentKey(key),
    );

    if (lastRotate && now - Number(lastRotate) < this.ROTATE_SECONDS && currentProxy) {
      return { proxy: JSON.parse(currentProxy), reused: true };
    }

    return this.rotateProxy(key, currentProxy ? JSON.parse(currentProxy) : null);
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
      { $match: {host: { $nin: exclude } } },
      { $sample: { size: 1 } },
    ]);

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

  // API tạo key (mua key)
  // async buyKeys(quantity: number, days: number) {
  //   const expiredAt = dayjs().add(days, 'day').unix(); // timestamp
  //   const keys = [];

  //   for (let i = 0; i < quantity; i++) {
  //     const key = this.generateKey();
  //     const newKey = await this.proxyModel.create({
  //       key,
  //       expired_at: expiredAt,
  //       active: true,
  //     });
  //     keys.push(newKey);
  //   }

  //   return keys;
  // }

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

