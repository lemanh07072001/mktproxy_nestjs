import { Injectable } from '@nestjs/common';
import { CreateTypeServiceDto } from './dto/create-type_service.dto';
import { UpdateTypeServiceDto } from './dto/update-type_service.dto';

@Injectable()
export class TypeServicesService {
  create(createTypeServiceDto: CreateTypeServiceDto) {
    return 'This action adds a new typeService';
  }

  findAll() {
    return `This action returns all typeServices`;
  }

  findOne(id: number) {
    return `This action returns a #${id} typeService`;
  }

  update(id: number, updateTypeServiceDto: UpdateTypeServiceDto) {
    return `This action updates a #${id} typeService`;
  }

  remove(id: number) {
    return `This action removes a #${id} typeService`;
  }
}
