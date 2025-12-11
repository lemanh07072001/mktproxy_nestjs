export const PROXY_XOAY = (key: string) => `proxy:${key}`;
export const inUseKey = 'proxy:inuse';
export const currentKey = (key: string) => `proxy:current:${key}`;
export const lastRotateKey = (key: string) =>  `proxy:lastrotate:${key}`;
export const recentKey = (key: string) =>  `proxy:recent:${key}`;
export const ROTATE_IP_COOLDOWN = (key: string) => `rotate_ip_cooldown:${key}`;