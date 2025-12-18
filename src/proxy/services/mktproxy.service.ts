import { Injectable, Logger } from '@nestjs/common';
import { Apikey } from 'src/apikey/entities/apikey.entity';
import { ProxyService } from '../proxy.service';
import { RotateResult } from '../interfaces/rotate-result.interface';

@Injectable()
export class MktproxyService {
  private readonly logger = new Logger(MktproxyService.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Rotate proxy for mktproxy.com partner
   * Uses internal ProxyService.getProxyForKey
   */
  async rotateProxy(apiKey: Apikey): Promise<RotateResult> {
    try {
      const dataResponse: any = await this.proxyService.getProxyForKey(apiKey.api_key);

      if (!dataResponse?.success || !dataResponse?.proxy) {
        return {
          success: false,
          message: dataResponse?.message || 'Không còn proxy khả dụng',
        };
      }

      const proxyArray = dataResponse.proxy.split(':');
      // proxyArray = [ip, port, user, pass]

      return {
        success: true,
        data: {
          realIpAddress: proxyArray[0],
          http: dataResponse.proxy,
          httpPort: proxyArray[1],
          host: proxyArray[0],
          user: proxyArray[2] || dataResponse.user,
          pass: proxyArray[3] || dataResponse.pass,
          timeRemaining: dataResponse.timeRemaining || 60,
          message: 'IP rotated successfully',
        },
      };
    } catch (error: any) {
      this.logger.error('MktProxy rotation error:', error.message);
      return {
        success: false,
        message: error.message || 'Internal proxy rotation failed',
      };
    }
  }
}
