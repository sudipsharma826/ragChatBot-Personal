import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createResend, generateOtpEmailTemplate } from './user.utils';
import { ConfigService } from '@nestjs/config';
import { SendOtpDto, VerifyOtpDto } from './user.dto';
import { SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

/**
 * Flow of the sendOtp function:
 * 1. Validate Email: Check if the email is provided and valid.
 * 2. Generate OTP: Create a random OTP code.
 * 3. Create a redis key-value pair with the email as the key and OTP as the value, set an expiration time (e.g., 5 minutes).
 * 4. Send OTP Email: Use Resend to send the OTP to the user's email.
 * 5. Return Success Response: Indicate that the OTP has been sent successfully.
 * 
 * Flow of the verifyOtp function:
 * 1. Validate Inputs: Check if both email and OTP are provided.
 * 2. Retrieve OTP from Redis: Get the stored OTP for the given email from Redis and comapred the otp that is passed with params
 * 3. Removed the redis key-value pair to invalidate the OTP after verification.
 * 4. Saved a record to the database with email,verifiedAt
 * 5. Saved a token information to the redis and return the token to the user.
 * (so for last 24 hrs of toekn in redis user can access the service directly)
 */


const REDIS_CLIENT = 'REDIS_CLIENT'; 
@Injectable()
export class UserService {
    private readonly resendApiKey: string;

    constructor(
        private readonly config: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
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

  // 🔹 Check if an OTP already exists for this email
  const existingOtp = await this.redis.get(`otp:${email}`);
  if (existingOtp) {
    return {
      status: '202',
      message: `An OTP has already been sent to ${email}. Please wait for 5 minutes before requesting a new one.`,
    };
  }

  // 🔹 Generate a secure 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 🔹 Prepare the payload to store
  const redisPayload = {
    email,
    otp,
  };

  // 🔹 Store in Redis with expiry of 5 minutes
  await this.redis.setex(`otp:${email}`, 300, JSON.stringify(redisPayload));

  // 🔹 Send OTP email using Resend service
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

async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    if (!email || !otp) {
        throw new Error('Email and OTP are required');
    }

    // 🔹 Retrieve OTP from Redis
    const storedOtpData = await this.redis.get(`otp:${email}`);
    if (!storedOtpData) {
        throw new Error('OTP has expired or does not exist');
    }

    const { otp: storedOtp } = JSON.parse(storedOtpData);

    // Compare OTPs
    if (otp !== storedOtp) {
        throw new Error('Invalid OTP');
    }

    // Remove OTP from Redis
    await this.redis.del(`otp:${email}`);

    // 🔹 Upsert to database: update verified_at if email exists, insert otherwise
    const { error } = await this.supabase
      .from('verified_users')
      .upsert([
        {
          email,
          verified_at: new Date().toISOString(),
        }
  ], { onConflict: 'email' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return { status: 'error', message: 'Failed to save verification record.' };
    }

  // Generate a Json Web Token (JWT) 
    const secret = this.config.get<string>('JWT_SECRET');
    const payload = { email, verifiedAt: new Date().toISOString() };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    //Saved the token to the redis with expiry of 24 hrs
    await this.redis.setex(`token:${email}`, 86400, token); // 86400 seconds = 24 hours

    return {
        status: '200',
        message: 'OTP verified successfully',
        token,
    };
}
}
