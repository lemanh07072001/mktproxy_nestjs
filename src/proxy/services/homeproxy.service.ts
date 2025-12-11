import { Injectable, Logger } from '@nestjs/common';
import { Apikey } from 'src/apikey/entities/apikey.entity';
import instance from 'src/common/axios-instance';
import { GetProxyUrl } from '../api/url.api';
import { RotateResult } from '../interfaces/rotate-result.interface';

@Injectable()
export class HomeproxyService {
  private readonly logger = new Logger(HomeproxyService.name);

  /**
   * Rotate proxy for homeproxy.vn partner
   * Calls external API: https://api.homeproxy.vn/api/merchant/proxies
   */
  async rotateProxy(apiKey: Apikey): Promise<RotateResult> {
    try {
      const token = apiKey.service_type?.partner?.token_api;
      const id_proxy_partner = apiKey?.parent_api_mapping?.id_proxy_partner;

      if (!token || !id_proxy_partner) {
        return {
          success: false,
          message: 'Missing token or proxy partner ID',
        };
      }

      const url = `${GetProxyUrl['homeproxy.vn']}/merchant/proxies?filter=id%3A%24eq%3Astring%3A${id_proxy_partner}`;

      const response = await instance.get<any>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const dataResponse = response.data;

      if (dataResponse?.data && dataResponse.data.length > 0) {
        const proxyData = dataResponse.data[0];
        const proxyInfo = proxyData.proxy;

        const ip = proxyInfo?.ipaddress?.ip || '';
        const port = proxyInfo?.port || '';
        const username = proxyInfo?.username || '';
        const password = proxyInfo?.password || '';
        const proxyString = `${ip}:${port}:${username}:${password}`;

        // Determine protocol based on apiKey.protocol
        const protocol = apiKey.protocol === 'socks5' ? 'socks5' : 'http';
        const portKey = `${protocol}Port`;

        return {
          success: true,
          data: {
            realIpAddress: ip,
            host: ip,
            [protocol]: proxyString,
            [portKey]: port,
            user: username,
            pass: password,
            timeRemaining: 60,
            message: 'IP rotated successfully',
          },
        };
      }

      return {
        success: false,
        message: 'Không tìm thấy proxy từ homeproxy.vn',
      };
    } catch (error: any) {
      this.logger.error('HomeProxy rotation error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Lỗi từ homeproxy.vn',
      };
    }
  }
}
