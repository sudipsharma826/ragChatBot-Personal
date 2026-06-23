import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RetrievesService } from './retrieves.service';
import { ChatGuard } from './retrieves.guard';

@Controller('retrieves')
export class RetrievesController {
  constructor(private readonly retrievesService: RetrievesService) {}
  // @UseGuards(ChatGuard)
  @Post('chat')
  handleChat(@Body('message') message: string, @Body('sessionId') sessionId?: string) {
    return this.retrievesService.handleChat({ message, sessionId });
  }
}
