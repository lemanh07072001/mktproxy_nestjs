import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  UseGuards,
  Post,
  Body,
  Req
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
import { OrderService } from 'src/order/order.service';

@Controller('api/proxies')
@UseGuards(AuthGuard)
export class ProxyController {
  constructor(
    private readonly apikeyService: ApikeyService,
    private readonly orderService: OrderService,
    private readonly proxyService: ProxyService
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

  private ensureApiKeyUsable(
    api_key: any,
  ): asserts api_key is {
    expired_at?: string | Date;
    protocol?: string;
    proxys?: any;
    parent_api_mapping?: { id_proxy_partner?: string | number };
    service_type: { api_type: string; partner?: { partner_code?: string; token_api?: string } };
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

            return { data: dataJson, success: true, code: 200, status: 'SUCCESS' };
          }

          const match = dataResponse?.message?.match(/\d+/);
          return {
            success: false,
            code: 40400006,
            message:
              'Proxy can be changed again in ' + (match ? match[0] : 0) + ' seconds.',
            status: 'FAIL',
            error: 'ERROR_PROXY',
          };

          break;
        }

        case 'homeproxy.vn': {
         const token = api_key.service_type.partner?.token_api;
         const id_proxy_partner = api_key?.parent_api_mapping?.id_proxy_partner;
         const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;
         
       
          const response = await instance.get<any>(urlGetOrderProxyPartner,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Accept' : 'application/json',
              },
            },
          );

          const dataResponse = response.data;
          if(dataResponse?.status === 'success') {
            const proxyArray = dataResponse?.proxy.split(':');
            const dataJson = {
              realIpAddress: dataResponse?.ip,
              [this.protocolKey(api_key?.protocol)]: dataResponse?.proxy,
              [`${this.protocolKey(api_key?.protocol)}Port`]: proxyArray[1],
              host: proxyArray[0],
              // message: 'Proxy can be changed again in ' + dataResponse?.timeRemaining + ' seconds.',
              // timeRemaining: dataResponse?.timeRemaining,
            };
            
            const ttl = Math.max(1, Number(dataResponse?.timeRemaining ?? 60) - 2);
            await redisSet(PROXY_XOAY(key), dataJson, ttl);

            return { data: dataJson, success: true, code: 200, status: 'SUCCESS' };
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

          const proxyArray = typeof dataProxy === 'string' ? JSON.parse(dataProxy) : dataProxy;
  
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
          return { data: dataJson, success: true, code: 200, status: 'SUCCESS' };
          break;
        }

        case 'homeproxy.vn': {
         const token = api_key.service_type.partner?.token_api;
         const id_proxy_partner = api_key?.parent_api_mapping?.id_proxy_partner;
         const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;
         
       
          const response = await instance.get<any>(urlGetOrderProxyPartner,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Accept' : 'application/json',
              },
            },
          );

          const dataResponse = response.data;
          if(dataResponse?.status === 'success') {
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
            const ttl = Math.max(1, Number(dataResponse?.timeRemaining ?? 60) - 2);
            await redisSet(PROXY_XOAY(key), dataJson, ttl);

            return { data: dataJson, success: true, code: 200, status: 'SUCCESS' };
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

  @Get('get/:key')
  // @Public()
  async getProxy(@Param('key') key: string) {
    const data = await this.proxyService.getProxyForKey(key);
    return {
      success: true,
      key,
      proxy: data?.proxy,
      reused: data?.reused,
    };
  }

  // Mua key
  @Post('buy')
  async buy(
    @Req() req,
    @Body() body: { 
      quantity: number; 
      days: number,
       serviceTypeId: number 
      }
    ) {
    const user = (req as any)?.user;
    const user_id = user?.sub ?? user?.id;

    
    const { quantity, days, serviceTypeId } = body;

    if (!quantity || !days || quantity <= 0 || days <= 0) {
      return { success: false, message: 'Số lượng hoặc ngày không hợp lệ' };
    }

    const dataOrder = {
      user_id,
      serviceTypeId
    }

    // const keys = await this.proxyService.buyKeys(quantity, days, user_id);
    // return {
    //   success: true,
    //   message: 'Tạo key thành công',
    //   total: keys.length,
    //   data: keys.map(k => ({
    //     key: k.key,
    //     expired_at: k.expired_at,
    //     expired_date: new Date(k.expired_at * 1000).toISOString(),
    //   })),
    // };
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
