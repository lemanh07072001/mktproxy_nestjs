/**
 * Request DTO for rotating proxy IP
 */
export class RotateProxyRequestDto {
  api_key: string;
}

/**
 * Data object returned on successful rotation
 */
export class RotateProxyDataDto {
  realIpAddress: string;
  host: string;
  http?: string;
  socks5?: string;
  httpPort?: string;
  socks5Port?: string;
  user?: string;
  pass?: string;
  timeRemaining?: number;
  message?: string;
}

/**
 * Response DTO for rotate proxy endpoint
 */
export class RotateProxyResponseDto {
  success: boolean;
  code: number;
  status: 'SUCCESS' | 'FAIL';
  data?: RotateProxyDataDto;
  message?: string;
  seconds?: number; // Remaining cooldown seconds (only for cooldown errors)
}
