import { Injectable, Logger } from '@nestjs/common';
import { Apikey } from 'src/apikey/entities/apikey.entity';
import instance from 'src/common/axios-instance';
import { GetProxyUrl } from '../api/url.api';
import { ProxyVNResponse } from '../response.interface';
import { RotateResult } from '../interfaces/rotate-result.interface';

@Injectable()
export class ProxyvnService {
  private readonly logger = new Logger(ProxyvnService.name);

  /**
   * Rotate proxy for proxy.vn partner
   * Calls external API: https://proxyxoay.shop/api/get.php
   */
  async rotateProxy(apiKey: Apikey): Promise<RotateResult> {
    try {
      const response = await instance.get<ProxyVNResponse>(
        GetProxyUrl['proxy.vn'],
        {
          params: { key: apiKey.api_key },
        },
      );

      const dataResponse = response.data;

      // Success case: status 100
      if (dataResponse?.status === 100) {
        const proxyHttp = (dataResponse.proxyhttp || '').replace(/:+$/, '');
        const proxySocks5 = (dataResponse.proxysocks5 || '').replace(/:+$/, '');

        const [httpHost = '', httpPort = ''] = proxyHttp.split(':');
        const [, socks5Port = ''] = proxySocks5.split(':');

        return {
          success: true,
          data: {
            realIpAddress: httpHost,
            http: proxyHttp,
            socks5: proxySocks5,
            httpPort,
            socks5Port,
            host: httpHost,
            timeRemaining: 60,
            message: 'IP rotated successfully',
          },
        };
      }

      // Error case: status 103
      if (dataResponse?.status === 103) {
        return {
          success: false,
          message: 'Lỗi kết nối đến máy chủ',
        };
      }

      // Other errors (extract seconds from message if available)
      const match = dataResponse?.message?.match(/\d+/);
      return {
        success: false,
        message: dataResponse?.message || 'Proxy rotation failed',
        seconds: match ? parseInt(match[0]) : undefined,
      };
    } catch (error: any) {
      this.logger.error('ProxyVN rotation error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Unknown error',
      };
    }
  }
}
