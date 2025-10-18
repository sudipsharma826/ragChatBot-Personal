// src/auth/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly validSecret: string;

  constructor() {
    // Get secret from environment variables
    this.validSecret = process.env.SECRET_KEY as string;
    
    if (!this.validSecret) {
      throw new Error('SECRET_KEY environment variable is required');
    }
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  private validateRequest(request: any): boolean {
    // Get secret from query parameters
    const secret = request.query.secret;
    if (!secret) {
      throw new UnauthorizedException('Secret key is required');
    }

    if (secret !== this.validSecret) {
      throw new UnauthorizedException('Invalid secret key');
    }

    return true;
  }
}