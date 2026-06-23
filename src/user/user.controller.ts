import { Controller, Post, Body, Delete, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UserService } from './user.service';
import { SendOtpDto, VerifyOtpDto } from './user.dto';
import { ChatGuard } from 'src/retrieves/retrieves.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('sendOtp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.userService.sendOtp(sendOtpDto);
  }

  @Post('verifyOtp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    return this.userService.verifyOtp(verifyOtpDto, res);
  }

  @Delete('history')
  @UseGuards(ChatGuard)
  async deleteHistory(@Req() req: any) {
    const email = req.user?.email;
    if (!email) return { status: 'error', message: 'Unauthorized' };
    return this.userService.deleteChatHistory(email);
  }
}

