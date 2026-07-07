import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PUSH_PROVIDER, PushPayload, PushProvider } from './push-provider.interface';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private provider: PushProvider,
  ) {}

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const devices = await this.prisma.pushDevice.findMany({ where: { userId, active: true } });
    if (devices.length === 0) return;

    const { invalidTokens } = await this.provider.sendToTokens(
      devices.map((d) => d.token),
      payload,
    );

    if (invalidTokens.length > 0) {
      await this.prisma.pushDevice.updateMany({
        where: { token: { in: invalidTokens } },
        data: { active: false },
      });
      this.logger.log(`Deactivated ${invalidTokens.length} invalid device token(s) for user ${userId}`);
    }
  }
}
