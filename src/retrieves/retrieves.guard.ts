import { CanActivate, ExecutionContext, Injectable, Inject } from "@nestjs/common";
import Redis from "ioredis";
import jwt from "jsonwebtoken";

const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class ChatGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis, // name is in the provider
  ) {
    this.jwtSecret = process.env.JWT_SECRET || '';
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return false;
    }

    try {
      const payload: any = jwt.verify(token, this.jwtSecret);
      const email = payload.email;
      if (!email) return false;

      // Check the token against Redis store
      const storedToken = await this.redis.get(`token:${email}`);
      if (storedToken !== token) {
        return false;
      }
      // attach the email to the request so controllers can read it
      try {
        const req = context.switchToHttp().getRequest();
        req.user = { email };
      } catch (e) {
        console.error('Error attaching user to request:', e);
      }
      console.log('✅ ChatGuard passed for email:', email);
      return true;
    } catch (error) {
      console.error('ChatGuard token verification error:', error);
      return false;
    }
  }
}