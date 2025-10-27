import { Test, TestingModule } from '@nestjs/testing';
import { TypeServicesController } from './type_services.controller';
import { TypeServicesService } from './type_services.service';

describe('TypeServicesController', () => {
  let controller: TypeServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TypeServicesController],
      providers: [TypeServicesService],
    }).compile();

    controller = module.get<TypeServicesController>(TypeServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
