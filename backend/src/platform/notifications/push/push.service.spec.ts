import { PushService } from './push.service';

describe('PushService', () => {
  let service: PushService;
  let prisma: any;
  let provider: any;

  beforeEach(() => {
    prisma = {
      pushDevice: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    provider = { sendToTokens: jest.fn() };
    service = new PushService(prisma, provider);
  });

  it('only loads active devices for the user', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([]);
    await service.sendToUser('user-1', { title: 'Hi', body: 'There' });
    expect(prisma.pushDevice.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', active: true },
    });
  });

  it('does nothing when the user has no active devices', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([]);
    await service.sendToUser('user-1', { title: 'Hi', body: 'There' });
    expect(provider.sendToTokens).not.toHaveBeenCalled();
  });

  it('sends to all active device tokens and deactivates the ones the provider reports invalid', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { token: 'tok-1' },
      { token: 'tok-2' },
    ]);
    provider.sendToTokens.mockResolvedValue({ invalidTokens: ['tok-2'] });

    await service.sendToUser('user-1', { title: 'Hi', body: 'There' });

    expect(provider.sendToTokens).toHaveBeenCalledWith(['tok-1', 'tok-2'], { title: 'Hi', body: 'There' });
    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { token: { in: ['tok-2'] } },
      data: { active: false },
    });
  });

  it('does not touch devices when no invalid tokens are reported', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([{ token: 'tok-1' }]);
    provider.sendToTokens.mockResolvedValue({ invalidTokens: [] });

    await service.sendToUser('user-1', { title: 'Hi', body: 'There' });

    expect(prisma.pushDevice.updateMany).not.toHaveBeenCalled();
  });
});
