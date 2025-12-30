/* eslint-disable */
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  Post,
  Body,
  Req,
} from '@nestjs/common';

import { ApikeyService } from 'src/apikey/apikey.service';
import instance from 'src/common/axios-instance';
import axios from 'axios';
import { AuthGuard } from 'src/guards/auth.guard';
import { Public } from 'src/guards/public.decorator';
import { GetProxyUrl } from './api/url.api';
import { ProxyVNResponse } from './response.interface';
import { PROXY_XOAY, ROTATE_IP_COOLDOWN } from 'src/common/key.cache';
import { redisGet, redisSet, getRedisTTL } from 'src/common/redis';
import { ProxyService } from './proxy.service';
import { HomeproxyService } from './services/homeproxy.service';
import { ProxyvnService } from './services/proxyvn.service';
import { MktproxyService } from './services/mktproxy.service';
import { RotateProxyRequestDto, RotateProxyResponseDto } from './dto/rotate-proxy.dto';

@Controller('api/proxies')
@UseGuards(AuthGuard)
export class ProxyController {
  constructor(
    private readonly apikeyService: ApikeyService,
    private readonly proxyService: ProxyService,
    private readonly homeproxyService: HomeproxyService,
    private readonly proxyvnService: ProxyvnService,
    private readonly mktproxyService: MktproxyService,
  ) { }

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

  @Get('new')
  @Public()
  async getApiKeyDetails(@Query('key') key: string) {
    try {
      const api_key = await this.apikeyService.getApiKeyDetails(key);

      this.ensureApiKeyUsable(api_key);

      switch (api_key.service_type.partner?.partner_code) {
        case 'proxy.vn': {
          // Kiểm tra cache trước
          const cachedProxy = await redisGet(PROXY_XOAY(key));
          if (cachedProxy) {
            // Tính timeRemaining từ expiresAt
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = cachedProxy.expiresAt
              ? Math.max(0, cachedProxy.expiresAt - now)
              : 0;

            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedProxy;

            // Loại bỏ :: ở cuối http và socks5 nếu có
            if (dataWithoutTimestamps.http) {
              dataWithoutTimestamps.http = dataWithoutTimestamps.http.replace(
                /:+$/,
                '',
              );
            }
            if (dataWithoutTimestamps.socks5) {
              dataWithoutTimestamps.socks5 =
                dataWithoutTimestamps.socks5.replace(/:+$/, '');
            }

            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

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
            const proxyHttpRaw = dataResponse?.proxyhttp || '';
            const proxySocks5Raw = dataResponse?.proxysocks5 || '';

            // Loại bỏ :: ở cuối nếu không có user/pass
            const proxyHttp = proxyHttpRaw.replace(/:+$/, '');
            const proxySocks5 = proxySocks5Raw.replace(/:+$/, '');

            await this.apikeyService.updateProxys(key, {
              http: proxyHttp,
              socks5: proxySocks5,
            });

            const [httpHost = '', httpPort = ''] = proxyHttp.split(':');
            const [, socks5Port = ''] = proxySocks5.split(':');

            const now = Math.floor(Date.now() / 1000);
            const actualTimeRemaining = 60;
            const expiresAt = now + actualTimeRemaining;

            const dataJson = {
              realIpAddress: httpHost,
              http: proxyHttp,
              socks5: proxySocks5,
              httpPort,
              socks5Port,
              host: httpHost,
              setAt: now,
              expiresAt,
              timeRemaining: actualTimeRemaining,
            };
            await redisSet(PROXY_XOAY(key), dataJson, actualTimeRemaining);

            const {
              setAt: _,
              expiresAt: __,
              ...dataWithoutTimestamps
            } = dataJson;
            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining: actualTimeRemaining,
                message: `Proxy mới, có thể xoay sau ${actualTimeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          } else if (dataResponse?.status === 103) {
            return {
              success: false,
              code: 40400006,
              message: 'Lỗi kết nối đến máy chủ',
              status: 'FAIL',
              error: 'ERROR_PROXY',
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
        }

        case 'homeproxy.vn': {
          // Kiểm tra cache trước
          const cachedProxy = await redisGet(PROXY_XOAY(key));
          if (cachedProxy) {
            // Tính timeRemaining từ expiresAt
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = cachedProxy.expiresAt
              ? Math.max(0, cachedProxy.expiresAt - now)
              : 0;

            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedProxy;
            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          // Cache hết hạn -> lấy proxy mới
          const token = api_key.service_type.partner?.token_api;
          const id_proxy_partner =
            api_key?.parent_api_mapping?.id_proxy_partner;
          const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies?filter=id%3A%24eq%3Astring%3A${id_proxy_partner}`;

          try {
            const response = await axios.get<any>(urlGetOrderProxyPartner, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });
            const dataResponse = response.data;

            // Kiểm tra có data và data[0] không
            if (dataResponse?.data && dataResponse.data.length > 0) {
              const proxyData = dataResponse.data[0];
              const proxyInfo = proxyData.proxy;

              const now = Math.floor(Date.now() / 1000);

              // Tạo proxy string: ip:port:user:pass
              const ip = proxyInfo?.ipaddress?.ip || '';
              const port = proxyInfo?.port || '';
              const username = proxyInfo?.username || '';
              const password = proxyInfo?.password || '';
              const proxyString = `${ip}:${port}:${username}:${password}`;

              // Gọi API rotate để lấy ip và timeRemaining (có retry khi 503)
              const rotateUrl = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;
              let timeRemaining = 60; // mặc định 60s
              let realIp = ip; // mặc định từ proxy info
              const maxRetries = 3;

              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                  const rotateRes = await axios.get(rotateUrl, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: '*/*',
                    },
                  });
                  console.log('✅ [homeproxy.vn] Rotate response:', rotateRes.data);

                  // Lấy ip và timeRemaining từ response
                  if (rotateRes.data?.ip) {
                    realIp = rotateRes.data.ip;
                  }
                  if (rotateRes.data?.timeRemaining) {
                    timeRemaining = rotateRes.data.timeRemaining;
                  }
                  break; // Thành công, thoát loop
                } catch (err: any) {
                  const errMessage = err?.response?.data?.message || err?.message || '';
                  const is503 = errMessage.includes('503') || err?.response?.status === 503;

                  if (is503 && attempt < maxRetries) {
                    console.log(`⏳ [homeproxy.vn] Rotate 503, retry ${attempt}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 5000)); // Đợi 5s trước khi retry
                    continue;
                  }
                  console.error('❌ [homeproxy.vn] Rotate error:', err?.response?.data || err?.message);
                  break;
                }
              }

              const dataJson = {
                realIpAddress: realIp,
                [this.protocolKey(api_key?.protocol)]: proxyString,
                [`${this.protocolKey(api_key?.protocol)}Port`]: port,
                host: ip,
                user: username,
                pass: password,
                setAt: now,
                expiresAt: now + timeRemaining,
                timeRemaining,
              };

              // TTL dựa vào timeRemaining từ lastRotate
              await redisSet(PROXY_XOAY(key), dataJson, timeRemaining);

              const {
                setAt: _,
                expiresAt: __,
                ...dataWithoutTimestamps
              } = dataJson;
              return {
                data: {
                  ...dataWithoutTimestamps,
                  timeRemaining,
                  message: `Proxy mới, có thể xoay sau ${timeRemaining}s`,
                },
                success: true,
                code: 200,
                status: 'SUCCESS',
              };
            }

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: 'Không tìm thấy proxy từ homeproxy.vn',
              error: 'ERROR_PROXY',
            };
          } catch (axiosError: any) {
            const errData = axiosError?.response?.data;
            console.error('❌ [/new] homeproxy.vn error:', {
              status: axiosError?.response?.status,
              data: axiosError?.response?.data?.message,
            });

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: errData?.message || 'Lỗi từ homeproxy.vn',
              error: 'ERROR_PROXY',
            };
          }
        }

        case 'mktproxy.com': {
          // Kiểm tra cache trước
          const cachedProxy = await redisGet(PROXY_XOAY(key));
          if (cachedProxy) {
            // Tính timeRemaining từ expiresAt
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = cachedProxy.expiresAt
              ? Math.max(0, cachedProxy.expiresAt - now)
              : 0;

            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedProxy;
            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },

              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          const dataResponse = await this.getProxy(key);

          // Kiểm tra nếu không có proxy
          if (!dataResponse?.success || !dataResponse?.proxy) {
            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: dataResponse?.message || 'Không còn proxy khả dụng',
              error: 'NO_PROXY_AVAILABLE',
            };
          }

          const proxyArray = dataResponse.proxy.split(':');
          // proxyArray = [ip, port, user, pass]

          const now = Math.floor(Date.now() / 1000);
          const setAt = now;
          const actualTimeRemaining = dataResponse.timeRemaining || 60;
          const expiresAt = now + actualTimeRemaining;

          const dataJson = {
            realIpAddress: proxyArray[0],
            http: dataResponse.proxy,
            httpPort: proxyArray[1],
            host: proxyArray[0],
            user: proxyArray[2] || dataResponse.user,
            pass: proxyArray[3] || dataResponse.pass,
            setAt,
            expiresAt,
            timeRemaining: actualTimeRemaining,
          };

          await redisSet(PROXY_XOAY(key), dataJson, actualTimeRemaining);

          const {
            setAt: _,
            expiresAt: __,
            ...dataWithoutTimestamps
          } = dataJson;

          return {
            data: {
              ...dataWithoutTimestamps,
              timeRemaining: actualTimeRemaining,
              message: `Proxy mới, có thể xoay sau ${actualTimeRemaining}s`,
            },
            success: true,
            code: 200,
            status: 'SUCCESS',
          };
        }

        case 'zingproxy.com': {
          // Kiểm tra cache trước
          const cachedProxy = await redisGet(PROXY_XOAY(key));
          if (cachedProxy) {
            // Tính timeRemaining từ expiresAt
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = cachedProxy.expiresAt
              ? Math.max(0, cachedProxy.expiresAt - now)
              : 0;

            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedProxy;
            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          const token = api_key.service_type.partner?.token_api;
          const uid_partner = api_key?.parent_api_mapping?.uid;
          const urlGetOrderProxyPartner = `${GetProxyUrl['zingproxy.com']}/proxy/dan-cu-viet-nam/get-ip?uId=${uid_partner}&location=Random`;

          try {
            const response = await axios.get(urlGetOrderProxyPartner, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });
     
            const dataResponse = response.data;

            // Kiểm tra response thành công từ zingproxy.com
            if (dataResponse?.status === 'success' && dataResponse?.proxy) {
              const proxyInfo = dataResponse.proxy;

              const now = Math.floor(Date.now() / 1000);
              // timeChangeAllowInSeconds từ API (VD: 240 = 4 phút)
              const actualTimeRemaining = Number(proxyInfo?.timeChangeAllowInSeconds) || 240;
              const expiresAt = now + actualTimeRemaining;

              // Tạo proxy string: ip:port:user:pass
              const ip = proxyInfo?.hostIp || proxyInfo?.ip || '';
              const port = proxyInfo?.portHttp || '';
              const username = proxyInfo?.username || '';
              const password = proxyInfo?.password || '';
              const proxyString = `${ip}:${port}:${username}:${password}`;

              const dataJson = {
                realIpAddress: proxyInfo?.ip || ip,
                [this.protocolKey(api_key?.protocol)]: proxyString,
                [`${this.protocolKey(api_key?.protocol)}Port`]: port,
                host: ip,
                user: username,
                pass: password,
                setAt: now,
                expiresAt,
                timeRemaining: actualTimeRemaining,
              };

            
              // Cache với TTL = timeChangeAllowInSeconds (240s)
              await redisSet(PROXY_XOAY(key), dataJson, actualTimeRemaining);

              const {
                setAt: _,
                expiresAt: __,
                ...dataWithoutTimestamps
              } = dataJson;

              return {
                data: {
                  ...dataWithoutTimestamps,
                  timeRemaining: actualTimeRemaining,
                  message: `Proxy mới, có thể xoay sau ${actualTimeRemaining}s`,
                },
                success: true,
                code: 200,
                status: 'SUCCESS',
              };
            }

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: dataResponse?.message || 'Không tìm thấy proxy từ zingproxy.com',
              error: 'ERROR_PROXY',
            };
          } catch (axiosError: any) {
            const errData = axiosError?.response?.data;
            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: errData?.message || 'Lỗi từ zingproxy.com',
              error: 'ERROR_PROXY',
            };
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('❌ getApiKeyDetails Error:', error.message);
        console.error('❌ Stack:', error.stack);
        return {
          success: false,
          code: 50000001,
          status: 'FAIL',
          message: error.message,
          error: error.name || 'EXCEPTION',
        };
      } else {
        console.error('❌ Unknown error:', error);
        return {
          success: false,
          code: 50000001,
          status: 'FAIL',
          message: 'Internal Server Error',
          error: 'EXCEPTION',
        };
      }
    }
  }

  @Get('current')
  @Public()
  async getProxyCurrent(@Query('key') key: string) {
    try {
      const api_key = await this.apikeyService.getApiKeyDetails(key);
      this.ensureApiKeyUsable(api_key);

      const cachedProxy = await redisGet(PROXY_XOAY(key));

      if (cachedProxy) {
        // Tính timeRemaining từ timestamp nếu có
        if (cachedProxy.expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          const timeRemaining = Math.max(0, cachedProxy.expiresAt - now);

          // Bỏ setAt và expiresAt khỏi response
          const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedProxy;

          return {
            data: {
              ...dataWithoutTimestamps,
              timeRemaining,
              message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
            },
            success: true,
            code: 200,
            status: 'SUCCESS',
          };
        }

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

          // Parse proxy string: ip:port:user:pass hoặc ip:port
          const httpParts = (proxyArray.http || '').split(':');
          const socks5Parts = (proxyArray.socks5 || '').split(':');

          const httpHost = httpParts[0] || '';
          const httpPort = httpParts[1] || '';
          const httpUser = httpParts[2] || '';
          const httpPass = httpParts[3] || '';

          const socks5Port = socks5Parts[1] || '';
          const socks5User = socks5Parts[2] || '';
          const socks5Pass = socks5Parts[3] || '';

          // Tạo proxy string đầy đủ hoặc chỉ ip:port nếu không có user/pass
          const proxyHttp =
            httpUser && httpPass
              ? `${httpHost}:${httpPort}:${httpUser}:${httpPass}`
              : `${httpHost}:${httpPort}`;
          const proxySocks5 =
            socks5User && socks5Pass
              ? `${socks5Parts[0]}:${socks5Port}:${socks5User}:${socks5Pass}`
              : `${socks5Parts[0]}:${socks5Port}`;

          const dataJson = {
            realIpAddress: httpHost,
            http: proxyHttp,
            socks5: proxySocks5,
            httpPort,
            socks5Port,
            host: httpHost,
            user: httpUser,
            pass: httpPass,
            message: 'Proxy hiện tại',
          };
          return {
            data: dataJson,
            success: true,
            code: 200,
            status: 'SUCCESS',
          };
        }

        case 'homeproxy.vn': {
          // Không có cache, gọi API để lấy proxy
          const token = api_key.service_type.partner?.token_api;
          const id_proxy_partner =
            api_key?.parent_api_mapping?.id_proxy_partner;
          const urlGetOrderProxyPartner = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies?filter=id%3A%24eq%3Astring%3A${id_proxy_partner}`;

          try {
            const response = await axios.get<any>(urlGetOrderProxyPartner, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });
            const dataResponse = response.data;

            // Kiểm tra có data và data[0] không
            if (dataResponse?.data && dataResponse.data.length > 0) {
              const proxyData = dataResponse.data[0];
              const proxyInfo = proxyData.proxy;

              const now = Math.floor(Date.now() / 1000);

              // Tạo proxy string: ip:port:user:pass
              const ip = proxyInfo?.ipaddress?.ip || '';
              const port = proxyInfo?.port || '';
              const username = proxyInfo?.username || '';
              const password = proxyInfo?.password || '';
              const proxyString = `${ip}:${port}:${username}:${password}`;

              // Gọi API rotate để lấy ip và timeRemaining (có retry khi 503)
              const rotateUrl = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies/${id_proxy_partner}/rotate`;
              let timeRemaining = 60; // mặc định 60s
              let realIp = ip; // mặc định từ proxy info
              const maxRetries = 3;

              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                  const rotateRes = await axios.get(rotateUrl, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: '*/*',
                    },
                  });
                  console.log('✅ [homeproxy.vn] Current - Rotate response:', rotateRes.data);

                  // Lấy ip và timeRemaining từ response
                  if (rotateRes.data?.ip) {
                    realIp = rotateRes.data.ip;
                  }
                  if (rotateRes.data?.timeRemaining) {
                    timeRemaining = rotateRes.data.timeRemaining;
                  }
                  break; // Thành công, thoát loop
                } catch (err: any) {
                  const errMessage = err?.response?.data?.message || err?.message || '';
                  const is503 = errMessage.includes('503') || err?.response?.status === 503;

                  if (is503 && attempt < maxRetries) {
                    console.log(`⏳ [homeproxy.vn] Current - Rotate 503, retry ${attempt}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 5000)); // Đợi 5s trước khi retry
                    continue;
                  }
                  console.error('❌ [homeproxy.vn] Current - Rotate error:', err?.response?.data || err?.message);
                  break;
                }
              }

              const dataJson = {
                realIpAddress: realIp,
                [this.protocolKey(api_key?.protocol)]: proxyString,
                [`${this.protocolKey(api_key?.protocol)}Port`]: port,
                host: ip,
                user: username,
                pass: password,
                setAt: now,
                expiresAt: now + timeRemaining,
                timeRemaining,
              };

              // TTL dựa vào timeRemaining từ rotate API
              await redisSet(PROXY_XOAY(key), dataJson, timeRemaining);

              const {
                setAt: _,
                expiresAt: __,
                ...dataWithoutTimestamps
              } = dataJson;
              return {
                data: {
                  ...dataWithoutTimestamps,
                  timeRemaining,
                  message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
                },
                success: true,
                code: 200,
                status: 'SUCCESS',
              };
            }

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: 'Không tìm thấy proxy từ homeproxy.vn',
              error: 'ERROR_PROXY',
            };
          } catch (axiosError: any) {
            console.error('❌ [/current] homeproxy.vn error:', {
              status: axiosError?.response?.status,
              data: axiosError?.response?.data?.message,
            });

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message:
                axiosError?.response?.data?.message || 'Lỗi từ homeproxy.vn',
              error: 'ERROR_PROXY',
            };
          }
        }

        case 'mktproxy.com':
        case 'mktproxy.vn': {
          // Kiểm tra cache trong Redis trước
          const cachedData = await redisGet(PROXY_XOAY(key));

          if (cachedData) {
            // Tính timeRemaining từ timestamp
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = Math.max(0, cachedData.expiresAt - now);

            // Bỏ setAt và expiresAt khỏi response
            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedData;

            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          // Nếu không có cache, lấy proxy mới
          const dataResponse = await this.getProxy(key);

          // Kiểm tra nếu không có proxy
          if (!dataResponse?.success || !dataResponse?.proxy) {
            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: dataResponse?.message || 'Không còn proxy khả dụng',
              error: 'NO_PROXY_AVAILABLE',
            };
          }

          const proxyArray = dataResponse.proxy.split(':');
          // proxyArray = [ip, port, user, pass]

          const now = Math.floor(Date.now() / 1000);
          const setAt = now;
          const actualTimeRemaining = dataResponse.timeRemaining || 60;
          const expiresAt = now + actualTimeRemaining;

          const dataJson = {
            realIpAddress: proxyArray[0],
            http: dataResponse.proxy, // Full proxy string: ip:port:user:pass
            httpPort: proxyArray[1],
            host: proxyArray[0],
            user: proxyArray[2] || dataResponse.user,
            pass: proxyArray[3] || dataResponse.pass,
            setAt,
            expiresAt,
            timeRemaining: actualTimeRemaining,
          };

          await redisSet(PROXY_XOAY(key), dataJson, actualTimeRemaining);

          // Bỏ setAt và expiresAt khỏi response
          const {
            setAt: _,
            expiresAt: __,
            ...dataWithoutTimestamps
          } = dataJson;

          return {
            data: {
              ...dataWithoutTimestamps,
              timeRemaining: actualTimeRemaining,
              message: `Proxy mới, có thể xoay sau ${actualTimeRemaining}s`,
            },
            success: true,
            code: 200,
            status: 'SUCCESS',
          };
        }

        case 'zingproxy.com': {
          // Kiểm tra cache trong Redis trước
          const cachedData = await redisGet(PROXY_XOAY(key));

          if (cachedData) {
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = Math.max(0, cachedData.expiresAt - now);

            const { setAt, expiresAt, ...dataWithoutTimestamps } = cachedData;

            return {
              data: {
                ...dataWithoutTimestamps,
                timeRemaining,
                message: `Proxy hiện tại, có thể xoay sau ${timeRemaining}s`,
              },
              success: true,
              code: 200,
              status: 'SUCCESS',
            };
          }

          // Không có cache, gọi API zingproxy.com
          const token = api_key.service_type.partner?.token_api;
          const uid_partner = api_key?.parent_api_mapping?.uid;
          const urlGetOrderProxyPartner = `${GetProxyUrl['zingproxy.com']}/proxy/dan-cu-viet-nam/get-ip?uId=${uid_partner}&location=Random`;

          try {
            const response = await axios.get(urlGetOrderProxyPartner, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });

            const dataResponse = response.data;

            if (dataResponse?.status === 'success' && dataResponse?.proxy) {
              const proxyInfo = dataResponse.proxy;

              const now = Math.floor(Date.now() / 1000);
              const actualTimeRemaining = Number(proxyInfo?.timeChangeAllowInSeconds) || 240;
              const expiresAt = now + actualTimeRemaining;

              const ip = proxyInfo?.hostIp || proxyInfo?.ip || '';
              const port = proxyInfo?.portHttp || '';
              const username = proxyInfo?.username || '';
              const password = proxyInfo?.password || '';
              const proxyString = `${ip}:${port}:${username}:${password}`;

              const dataJson = {
                realIpAddress: proxyInfo?.ip || ip,
                [this.protocolKey(api_key?.protocol)]: proxyString,
                [`${this.protocolKey(api_key?.protocol)}Port`]: port,
                host: ip,
                user: username,
                pass: password,
                setAt: now,
                expiresAt,
                timeRemaining: actualTimeRemaining,
              };

              await redisSet(PROXY_XOAY(key), dataJson, actualTimeRemaining);

              const {
                setAt: _,
                expiresAt: __,
                ...dataWithoutTimestamps
              } = dataJson;

              return {
                data: {
                  ...dataWithoutTimestamps,
                  timeRemaining: actualTimeRemaining,
                  message: `Proxy hiện tại, có thể xoay sau ${actualTimeRemaining}s`,
                },
                success: true,
                code: 200,
                status: 'SUCCESS',
              };
            }

            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: dataResponse?.message || 'Không tìm thấy proxy từ zingproxy.com',
              error: 'ERROR_PROXY',
            };
          } catch (axiosError: any) {
            const errData = axiosError?.response?.data;
            return {
              success: false,
              code: 50000001,
              status: 'FAIL',
              message: errData?.message || 'Lỗi từ zingproxy.com',
              error: 'ERROR_PROXY',
            };
          }
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
  @Get('get')
  @Public()
  async getProxy(@Query('key') key: string) {
    try {
      const data = await this.proxyService.getProxyForKey(key);


      if (!data || !data.proxy) {
        return {
          success: false,
          message: 'Không còn proxy khả dụng',
          error: 'NO_PROXY_AVAILABLE',
        };
      }

      // Format proxy string theo định dạng: ip:port:user:pass
      const proxyStr =
        data.proxy.user && data.proxy.pass
          ? `${data.proxy.ip}:${data.proxy.port}:${data.proxy.user}:${data.proxy.pass}`
          : `${data.proxy.ip}:${data.proxy.port}`;

      const response: any = {
        success: true,
        proxy: proxyStr,
        ip: data.proxy.ip,
        port: data.proxy.port,
        user: data.proxy.user,
        pass: data.proxy.pass,
      };

      const now = Math.floor(Date.now() / 1000);

      if (
        data.reused &&
        'timeRemaining' in data &&
        data.timeRemaining !== undefined
      ) {
        response.message = `Proxy hiện tại (xoay sau ${data.timeRemaining}s)`;
        response.timeRemaining = data.timeRemaining;
        response.nextRotateAt = now + data.timeRemaining;
      } else {
        response.message = 'Proxy mới đã được xoay';
        response.timeRemaining = 60;
        response.nextRotateAt = now + 60;
      }

      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
      };
    }
  }

  // API xoay proxy ngay lập tức
  @Get('rotate')
  @Public()
  async rotateProxy(@Query('key') key: string) {
    try {
      await this.proxyService.validateKey(key);

      // Force rotation by clearing cache
      const currentProxy = await this.proxyService['redis'].get(
        `proxy:current:${key}`,
      );

      const data = await this.proxyService['rotateProxy'](
        key,
        currentProxy ? JSON.parse(currentProxy) : null,
      );

      if (!data || !data.proxy) {
        return {
          success: false,
          message: 'Không còn proxy khả dụng',
          error: 'NO_PROXY_AVAILABLE',
        };
      }

      const proxyStr =
        data.proxy.user && data.proxy.pass
          ? `${data.proxy.ip}:${data.proxy.port}:${data.proxy.user}:${data.proxy.pass}`
          : `${data.proxy.ip}:${data.proxy.port}`;

      return {
        success: true,
        proxy: proxyStr,
        ip: data.proxy.ip,
        port: data.proxy.port,
        user: data.proxy.user,
        pass: data.proxy.pass,
        message: 'Proxy đã được xoay thành công',
        timeRemaining: 60, // Vừa xoay xong, còn 60s
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
  @Public()
  async buyProxyKey(
    @Req() req,
    @Body() body: { quantity?: number; time?: number },
  ) {
    try {
      const { quantity = 1, time = 30 } = body;

      const result = await this.proxyService.buyKeys(quantity, time);

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
  async buyProxyKeyTest(@Body() body: { quantity?: number; time?: number }) {
    try {
      const { quantity = 1, time = 30 } = body;

      const result = await this.proxyService.buyKeys(quantity, time);

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

    return {
      success: true,
      total: proxies.length,
      data: proxies,
    };
  }

  /**
   * API xoay IP proxy (hỗ trợ nhiều partner)
   * Endpoint: POST /api/proxies/rotate
   * Body: { api_key: string }
   */
  @Post('rotate')
  @Public()
  async rotateProxyIp(
    @Body() body: RotateProxyRequestDto,
  ): Promise<RotateProxyResponseDto> {
    try {
      const { api_key } = body;

      // 1. Validate api_key parameter
      if (!api_key) {
        return {
          success: false,
          code: 400,
          status: 'FAIL',
          message: 'api_key is required',
        };
      }

      // 2. Get ApiKey with relations (type_service.partner)
      const apiKeyData = await this.apikeyService.getApiKeyDetails(api_key);

      // 3. Check if api key exists and is valid (expired, status, type)
      this.ensureApiKeyUsable(apiKeyData);

      // 4. Check Redis cooldown - CRITICAL BLOCKING LOGIC
      const cooldownKey = ROTATE_IP_COOLDOWN(api_key);
      const ttl = await getRedisTTL(cooldownKey);

      if (ttl > 0) {
        // REJECT: Still in cooldown period
        return {
          success: false,
          code: 400,
          status: 'FAIL',
          message: `Còn ${ttl} giây nữa mới có thể xoay IP. Vui lòng thử lại sau.`,
          seconds: ttl,
        };
      }

      // 5. Check partner code
      if (!apiKeyData.service_type || !apiKeyData.service_type.partner) {
        return {
          success: false,
          code: 500,
          status: 'FAIL',
          message: 'Partner not configured',
        };
      }

      const partnerCode = apiKeyData.service_type.partner.partner_code;

      // 6. Route to partner-specific rotation method
      let rotateResult: any;

      switch (partnerCode) {
        case 'homeproxy.vn':
          rotateResult = await this.homeproxyService.rotateProxy(apiKeyData);
          break;

        case 'proxy.vn':
          rotateResult = await this.proxyvnService.rotateProxy(apiKeyData);
          break;

        case 'mktproxy.com':
          rotateResult = await this.mktproxyService.rotateProxy(apiKeyData);
          break;

        default:
          return {
            success: false,
            code: 400,
            status: 'FAIL',
            message: `Partner does not support IP rotation: ${partnerCode}`,
          };
      }

      // 7. Handle rotation result
      if (rotateResult.success) {
        // Set Redis cooldown on success (60 seconds)
        const now = Math.floor(Date.now() / 1000);
        await redisSet(cooldownKey, now, 60);

        // Also update proxy cache for GET /api/proxies/new endpoint
        const cacheKey = PROXY_XOAY(api_key);
        const expiresAt = now + 60;
        const cacheData = {
          ...rotateResult.data,
          setAt: now,
          expiresAt,
        };
        await redisSet(cacheKey, cacheData, 60);

        return {
          success: true,
          code: 200,
          status: 'SUCCESS',
          data: rotateResult.data,
          message: rotateResult.data?.message || 'IP rotated successfully',
        };
      } else {
        // Rotation failed (could be partner cooldown or error)
        return {
          success: false,
          code: 400,
          status: 'FAIL',
          message: rotateResult.message || 'Rotation failed',
          seconds: rotateResult.seconds,
        };
      }
    } catch (error: unknown) {
      // Handle HttpExceptions from ensureApiKeyUsable
      if (error instanceof HttpException) {
        const response: any = error.getResponse();
        return {
          success: false,
          code: response.code || error.getStatus(),
          status: 'FAIL',
          message: response.message || 'Bad Request',
        };
      }

      // Log and return 500 for unexpected errors
      if (error instanceof Error) {
        console.error('rotateProxyIp Error:', error.message);
        return {
          success: false,
          code: 500,
          status: 'FAIL',
          message: error.message || 'Internal Server Error',
        };
      }

      console.error('Unknown error:', error);
      return {
        success: false,
        code: 500,
        status: 'FAIL',
        message: 'Internal Server Error',
      };
    }
  }
}
