import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  Get,
} from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UserService,
  ) {}

  //   @Post('register')
  //   register(@Body() authService: CreateUserDto) {
  //     return this.usersService.create(authService);
  //   }

  //   @Post('login')
  //   login(@Request() req: any) {
  //     return this.authService.login(req.body);
  //   }

  //   @Get('profile')
  //   getProfile(@Request() req: any) {
  //     return req.user;
  //   }

  //   @Public()
  //   @Post('refresh')
  //   refresh(@Body('refresh_token') refresh_token: any) {
  //     console.log(refresh_token);
  //     return this.authService.refresh(refresh_token);
  //   }
}
