import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";

@Injectable()
export class ChatGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || '';
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    let token = '';

    // First try to get token from cookies
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.split('=').map(c => c.trim());
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      token = cookies['token'];
    }

    // Fallback to Authorization header
    if (!token) {
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return false;
    }

    try {
      const payload: any = jwt.verify(token, this.jwtSecret);
      const email = payload.email;
      if (!email) return false;
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