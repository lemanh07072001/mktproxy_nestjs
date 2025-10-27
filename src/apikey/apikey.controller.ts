import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { UpdateApikeyDto } from './dto/update-apikey.dto';

@Controller('apikey')
export class ApikeyController {
  constructor(private readonly apikeyService: ApikeyService) {}

  @Get()
  async getAll() {
    return this.apikeyService.findAll();
  }
}
