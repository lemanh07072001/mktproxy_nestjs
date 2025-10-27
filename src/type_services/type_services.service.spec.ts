import { Test, TestingModule } from '@nestjs/testing';
import { TypeServicesService } from './type_services.service';

describe('TypeServicesService', () => {
  let service: TypeServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TypeServicesService],
    }).compile();

    service = module.get<TypeServicesService>(TypeServicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
