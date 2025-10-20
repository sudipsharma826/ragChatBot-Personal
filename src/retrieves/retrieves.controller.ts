import { Body, Controller, Post } from '@nestjs/common';
import { RetrievesService } from './retrieves.service';

@Controller('retrieves')
export class RetrievesController {
  constructor(private readonly retrievesService: RetrievesService) {}

  @Post('chat')
  handleChat(@Body('message') message: string) {
    return this.retrievesService.handleChat({ message });
  }
}
