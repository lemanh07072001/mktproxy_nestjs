import { Injectable } from '@nestjs/common';

import { ApikeyService } from 'src/apikey/apikey.service';

@Injectable()
export class ProxyService {
  constructor(private readonly apikeyService: ApikeyService) {}
}
