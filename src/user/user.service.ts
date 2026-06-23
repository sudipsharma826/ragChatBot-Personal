import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createResend, generateOtpEmailTemplate } from './user.utils';
import { ConfigService } from '@nestjs/config';
import { SendOtpDto, VerifyOtpDto } from './user.dto';
import { SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { SUPABASE_CLIENT } from 'src/app.utils';
import type { Response } from 'express';
import * as crypto from 'crypto';



const REDIS_CLIENT = 'REDIS_CLIENT'; 
@Injectable()
export class UserService {
    private readonly resendApiKey: string;

    constructor(
        private readonly config: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @Inject(SUPABASE_CLIENT) private supabase: SupabaseClient,
    ) {
        this.resendApiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
        if (!this.resendApiKey) {
            throw new Error('RESEND_API_KEY is required in environment');
        }
    }

   async sendOtp(sendOtpDto: SendOtpDto) {
  const { email } = sendOtpDto;

  if (!email) {
    throw new Error('Email is required to send OTP');
  }

  const existingOtp = await this.redis.get(`otp:${email}`);
  if (existingOtp) {
    return {
      status: '202',
      message: `An OTP has already been sent to ${email}. Please wait for 5 minutes before requesting a new one.`,
    };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const redisPayload = {
    email,
    otp,
  };

  await this.redis.setex(`otp:${email}`, 300, JSON.stringify(redisPayload));

  await createResend({
    apiKey: this.resendApiKey,
    email,
    subject: `Verify your email with OTP: ${otp}`,
    html: generateOtpEmailTemplate(otp, email),
  });

  return {
    status: '200',
    message: `OTP has been sent to ${email}. Please verify within 5 minutes.`,
  };
}

async verifyOtp(verifyOtpDto: VerifyOtpDto, res: Response) {
    const { email, otp } = verifyOtpDto;

    if (!email || !otp) {
        throw new Error('Email and OTP are required');
    }

    const storedOtpData = await this.redis.get(`otp:${email}`);
    if (!storedOtpData) {
        throw new Error('OTP has expired or does not exist');
    }

    const { otp: storedOtp } = JSON.parse(storedOtpData);

    if (otp !== storedOtp) {
        throw new Error('Invalid OTP');
    }

    await this.redis.del(`otp:${email}`);

    const { error } = await this.supabase
      .from('verified_users')
      .upsert([
        {
          email,
          verified_at: new Date().toISOString(),
          // Store the last verification time as well
          last_verified_at: new Date().toISOString(),
        },
      ], { onConflict: 'email' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return { status: 'error', message: 'Failed to save verification record.' };
    }

    const secret = this.config.get<string>('JWT_SECRET');
    const payload = { email, verifiedAt: new Date().toISOString() };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    await this.redis.setex(`token:${email}`, 86400, token);

    // Set token as an HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Generate a session ID for the frontend to use in chat requests
    const sessionId = crypto.randomUUID();

    return {
        status: '200',
        message: 'OTP verified successfully',
        token, // Kept for non-browser clients (e.g. mobile)
        sessionId,
    };
}

  // Delete chat history for a user (stored in Redis list `chat:{email}`)
  async deleteChatHistory(email: string) {
    if (!email) {
      return { status: 'error', message: 'Email is required' };
    }

    try {
      // delete Redis list where chat messages are stored
      await this.redis.del(`chat:${email}`);


      return { status: '200', message: 'Chat history deleted' };
    } catch (error) {
      console.error('Failed to delete chat history:', error);
      return { status: 'error', message: 'Failed to delete chat history' };
    }
  }
}
