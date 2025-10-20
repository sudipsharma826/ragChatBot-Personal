import { Controller, Post, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { SendOtpDto, VerifyOtpDto } from './user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('sendOtp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.userService.sendOtp(sendOtpDto);
  }

  @Post('verifyOtp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.userService.verifyOtp(verifyOtpDto);
  }
}

