import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { sub: string; email: string; orgId: string }) {
    const refreshToken = req.body?.refreshToken as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Refresh token not provided');
    return { ...payload, refreshToken };
  }
}
