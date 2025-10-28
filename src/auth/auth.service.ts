import { UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  validateUser(email: string, password: string) {
    return this.usersService.validateUser(email, password);
  }

  login(user: any) {
    const payload = { email: user.email, sub: user.id };

    // 1️⃣ Access token (hết hạn nhanh)
    const access_token = this.jwtService.sign(payload, {
      expiresIn: '15m', // 15 phút
      secret: process.env.JWT_SECRET,
    });

    // 2️⃣ Refresh token (hết hạn lâu)
    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '7d', // 7 ngày
      secret: process.env.JWT_REFRESH_SECRET,
    });

    // 3️⃣ Trả về cho client
    return {
      access_token,
      refresh_token,
      token_type: 'bearer',
    };
  }
  async refresh(refresh_token: string) {
    if (!refresh_token)
      throw new UnauthorizedException('Missing refresh token');

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = await this.jwtService.verifyAsync(refresh_token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // 🔄 Tạo access token mới
      const newAccessToken = this.jwtService.sign(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { email: payload.email, sub: payload.sub },
        { secret: process.env.JWT_SECRET, expiresIn: '15m' },
      );

      return { access_token: newAccessToken };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
