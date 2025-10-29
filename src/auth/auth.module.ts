import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../guards/auth.guard';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret:
        'RJnPrs1zjw1rzNVInrkSoRopnad7DEIrFsqNVzoBqDRGhtovLeYLOnTMPaUuS1aq',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, AuthGuard],
  controllers: [AuthController],
  exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
