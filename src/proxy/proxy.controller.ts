/* eslint-disable */
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  UseGuards,
  Post,
  Body,
  Req,
} from '@nestjs/common';

import { ApikeyService } from 'src/apikey/apikey.service';
import instance from 'src/common/axios-instance';
import { AuthGuard } from 'src/guards/auth.guard';
import { Public } from 'src/guards/public.decorator';
import { GetProxyUrl } from './api/url.api';
import { ProxyVNResponse } from './response.interface';
import { PROXY_XOAY } from 'src/common/key.cache';
import { redisGet, redisSet } from 'src/common/redis';
import { ProxyService } from './proxy.service';

@Controller('api/proxies')
@UseGuards(AuthGuard)
export class ProxyController {
  constructor(
    private readonly apikeyService: ApikeyService,

    private readonly proxyService: ProxyService,
  ) {}

  private throwBadRequest(code: number, message: string, error: string): never {
    throw new HttpException(
      {
        success: false,
        code,
        message,
        status: 'FAIL',
        error,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  private ensureApiKeyUsable(api_key: any): asserts api_key is {
    expired_at?: string | Date;
    protocol?: string;
    proxys?: any;
    parent_api_mapping?: { id_proxy_partner?: string | number };
    service_type: {
      api_type: string;
      partner?: { partner_code?: string; token_api?: string };
    };
  } {
    if (!api_key) {
      this.throwBadRequest(40000006, 'Key not found', 'KEY_NOT_FOUND');
    }

    const isExpired = api_key.expired_at
      ? new Date(api_key.expired_at).getTime() <= Date.now()
      : false;

    if (isExpired) {
      this.throwBadRequest(40000006, 'Key has expired', 'KEY_EXPIRED');
    }

    if (!api_key.service_type || api_key.service_type?.api_type !== 'buy_api') {
      this.throwBadRequest(40000006, 'Error key type', 'ERROR_KEY_TYPE');
    }
  }

  private protocolKey(protocol?: string): 'http' | 'socks5' {
    return protocol === 'socks5' ? 'socks5' : 'http';
  }

  @Get('new/:key')
  @Public()
  async getApiKeyDetails(@Param('key') key: string) {
    try {
      const api_key = await this.apikeyService.getApiKeyDetails(key);
      this.ensureApiKeyUsable(api_key);

      switch (api_key.service_type.partner?.partner_code) {
        case 'proxy.vn': {
          const response = await instance.get<ProxyVNResponse>(
            GetProxyUrl['proxy.vn'],
            {
              params: {
                key: key,
              },
            },
          );

          const dataResponse = response.data;

          if (dataResponse?.status === 100) {
            const proxyHttp = dataResponse?.proxyhttp || '';
            const proxySocks5 = dataResponse?.proxysocks5 || '';

            await this.apikeyService.updateProxys(key, {
              http: proxyHttp,
              socks5: proxySocks5,
            });

            const [httpHost = '', httpPort = ''] = proxyHttp.split(':');
            const [, socks5Port = ''] = proxySocks5.split(':');

            const dataJson = {
              realIpAddress: httpHost,
              http: proxyHttp,
              socks5: proxySocks5,
              httpPort,
              socks5Port,
              host: httpHost,
            };
            await redisSet(PROXY_XOAY(key), dataJson, 60);

            return {
              data: dataJson,
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          const match = dataResponse?.message?.match(/\d+/);
          return {
            success: false,
            code: 40400006,
            message:
              'Proxy can be changed again in ' +
              (match ? match[0] : 0) +
              ' seconds.',
            status: 'FAIL',
            error: 'ERROR_PROXY',
          };

          break;
        }

        case 'homeproxy.vn': {
          const token = api_key.service_type.partner?.token_api;
          const id_proxy_partner =
            api_key?.parent_api_mapping?.id_proxy_partner;
          const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;

          const response = await instance.get<any>(urlGetOrderProxyPartner, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });

          const dataResponse = response.data;
          if (dataResponse?.status === 'success') {
            const proxyArray = dataResponse?.proxy.split(':');
            const dataJson = {
              realIpAddress: dataResponse?.ip,
              [this.protocolKey(api_key?.protocol)]: dataResponse?.proxy,
              [`${this.protocolKey(api_key?.protocol)}Port`]: proxyArray[1],
              host: proxyArray[0],
              // message: 'Proxy can be changed again in ' + dataResponse?.timeRemaining + ' seconds.',
              // timeRemaining: dataResponse?.timeRemaining,
            };

            const ttl = Math.max(
              1,
              Number(dataResponse?.timeRemaining ?? 60) - 2,
            );
            await redisSet(PROXY_XOAY(key), dataJson, ttl);

            return {
              data: dataJson,
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          return {
            success: false,
            code: 50000001,
            status: 'FAIL',
            error: 'ERROR_PROXY',
          };
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('❌ Message:', error.message);
      } else {
        console.error('❌ Unknown error:', error);
      }

      return {
        success: false,
        code: 50000001,
        status: 'FAIL',
        message: 'Internal Server Error',
        error: 'EXCEPTION',
      };
    }
  }

  @Get('current/:key')
  @Public()
  async getProxyCurrent(@Param('key') key: string) {
    try {
      const api_key = await this.apikeyService.getApiKeyDetails(key);
      this.ensureApiKeyUsable(api_key);

      const cachedProxy = await redisGet(PROXY_XOAY(key));

      if (cachedProxy) {
        return {
          data: cachedProxy,
          success: true,
          code: 200,
          status: 'SUCCESS',
        };
      }

      switch (api_key.service_type.partner?.partner_code) {
        case 'proxy.vn': {
          const dataProxy = api_key?.proxys;

          const proxyArray =
            typeof dataProxy === 'string' ? JSON.parse(dataProxy) : dataProxy;

          const proxyHttp = (proxyArray.http || '').split(':');
          const proxySocks5 = (proxyArray.socks5 || '').split(':');

          const dataJson = {
            realIpAddress: proxyHttp[0],
            http: proxyArray.http,
            socks5: proxyArray.socks5,
            httpPort: proxyHttp[1],
            socks5Port: proxySocks5[1],
            host: proxyHttp[0],
          };
          return {
            data: dataJson,
            success: true,
            code: 200,
            status: 'SUCCESS',
          };
          break;
        }

        case 'homeproxy.vn': {
          const token = api_key.service_type.partner?.token_api;
          const id_proxy_partner =
            api_key?.parent_api_mapping?.id_proxy_partner;
          const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;

          const response = await instance.get<any>(urlGetOrderProxyPartner, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });

          const dataResponse = response.data;
          if (dataResponse?.status === 'success') {
            const proxyArray = dataResponse?.proxy.split(':');
            const dataJson = {
              realIpAddress: dataResponse?.ip,
              [this.protocolKey(api_key?.protocol)]: dataResponse?.proxy,
              [`${this.protocolKey(api_key?.protocol)}Port`]: proxyArray[1],
              host: proxyArray[0],
              // message: 'Proxy can be changed again in ' + dataResponse?.timeRemaining + ' seconds.',
              // timeRemaining: dataResponse?.timeRemaining,
            };

            await redisSet(PROXY_XOAY(key), dataJson, 60);
            const ttl = Math.max(
              1,
              Number(dataResponse?.timeRemaining ?? 60) - 2,
            );
            await redisSet(PROXY_XOAY(key), dataJson, ttl);

            return {
              data: dataJson,
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          return {
            success: false,
            code: 50000001,
            status: 'FAIL',
            error: 'ERROR_PROXY',
          };
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('❌ Message:', error.message);
      } else {
        console.error('❌ Unknown error:', error);
      }
    }
  }

  // API lấy proxy (tự động xoay mỗi phút)
  @Get('get/:key')
  @Public()
  async getProxy(@Param('key') key: string) {
    try {
      const data = await this.proxyService.getProxyForKey(key);

      if (!data || !data.proxy) {
        return {
          success: false,
          message: 'Không còn proxy khả dụng',
          error: 'NO_PROXY_AVAILABLE',
        };
      }

      // Format proxy string
      const proxyStr = data.proxy.user && data.proxy.pass
        ? `${data.proxy.user}:${data.proxy.pass}@${data.proxy.host}:${data.proxy.port}`
        : `${data.proxy.host}:${data.proxy.port}`;

      return {
        success: true,
        key,
        proxy: proxyStr,
        host: data.proxy.host,
        port: data.proxy.port,
        user: data.proxy.user,
        pass: data.proxy.pass,
        reused: data.reused,
        message: data.reused
          ? 'Proxy hiện tại (chưa đến thời gian xoay)'
          : 'Proxy mới đã được xoay',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
      };
    }
  }

  // API xoay proxy ngay lập tức
  @Get('rotate/:key')
  @Public()
  async rotateProxy(@Param('key') key: string) {
    try {
      await this.proxyService.validateKey(key);

      // Force rotation by clearing cache
      const currentProxy = await this.proxyService['redis'].get(
        `proxy:current:${key}`
      );

      const data = await this.proxyService['rotateProxy'](
        key,
        currentProxy ? JSON.parse(currentProxy) : null
      );

      if (!data || !data.proxy) {
        return {
          success: false,
          message: 'Không còn proxy khả dụng',
          error: 'NO_PROXY_AVAILABLE',
        };
      }

      const proxyStr = data.proxy.user && data.proxy.pass
        ? `${data.proxy.user}:${data.proxy.pass}@${data.proxy.host}:${data.proxy.port}`
        : `${data.proxy.host}:${data.proxy.port}`;

      return {
        success: true,
        key,
        proxy: proxyStr,
        host: data.proxy.host,
        port: data.proxy.port,
        user: data.proxy.user,
        pass: data.proxy.pass,
        message: 'Proxy đã được xoay thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
      };
    }
  }

  // API mua key proxy xoay
  @Post('buy-key')
  async buyProxyKey(
    @Req() req,
    @Body() body: { quantity?: number; days?: number },
  ) {
    try {
      const user = (req as any)?.user;
      const user_id = user?.sub ?? user?.id;

      if (!user_id) {
        return {
          success: false,
          message: 'Unauthorized',
          error: 'UNAUTHORIZED',
        };
      }

      const { quantity = 1, days = 30 } = body;

      console.log('📦 Buy-key request:', { body, quantity, days, user_id });

      const result = await this.proxyService.buyKeys(user_id, quantity, days);

      return {
        success: true,
        message: `Tạo ${result.length} key thành công`,
        total: result.length,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
      };
    }
  }

  // API test mua key không cần auth (chỉ để test)
  @Post('buy-key-test')
  @Public()
  async buyProxyKeyTest(@Body() body: { quantity?: number; days?: number }) {
    try {
      const { quantity = 1, days = 30 } = body;

      console.log('📦 Buy-key-test request:', { body, quantity, days });

      const test_user_id = 'test_user_123';
      const result = await this.proxyService.buyKeys(test_user_id, quantity, days);

      return {
        success: true,
        message: `Tạo ${result.length} key thành công`,
        total: result.length,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
      };
    }
  }

  @Get('all')
  @Public()
  async getAllProxies() {
    const proxies = await this.proxyService.getAllProxies();
    console.log('dsa');

    return {
      success: true,
      total: proxies.length,
      data: proxies,
    };
  }
}
