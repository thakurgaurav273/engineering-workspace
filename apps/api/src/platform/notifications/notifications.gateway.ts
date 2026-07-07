import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string }>(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;
      if (!this.userSockets.has(payload.sub)) this.userSockets.set(payload.sub, new Set());
      this.userSockets.get(payload.sub)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (userId) this.userSockets.get(userId)?.delete(client.id);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) return;
    for (const id of socketIds) {
      this.server.to(id).emit(event, payload);
    }
  }
}
