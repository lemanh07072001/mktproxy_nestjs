import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('apikey')
@UseGuards(AuthGuard)
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Get()
  async getAll() {
    return this.apikeyService.findAll();
  }
}
