/**
 * Standard result interface for all partner rotation services
 */
export interface RotateResult {
  success: boolean;
  data?: {
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
  };
  message?: string;
  seconds?: number; // For cooldown scenarios
}
