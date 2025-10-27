import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TypeServicesService } from './type_services.service';
import { CreateTypeServiceDto } from './dto/create-type_service.dto';
import { UpdateTypeServiceDto } from './dto/update-type_service.dto';

@Controller('type-services')
export class TypeServicesController {
  constructor(private readonly typeServicesService: TypeServicesService) {}

  @Post()
  create(@Body() createTypeServiceDto: CreateTypeServiceDto) {
    return this.typeServicesService.create(createTypeServiceDto);
  }

  @Get()
  findAll() {
    return this.typeServicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.typeServicesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTypeServiceDto: UpdateTypeServiceDto) {
    return this.typeServicesService.update(+id, updateTypeServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.typeServicesService.remove(+id);
  }
}
