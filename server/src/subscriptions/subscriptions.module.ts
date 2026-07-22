import { Module, Provider } from '@nestjs/common';

import { MemorySubscriptionRepository } from './memory-subscriptions.repository';
import { SubscriptionsController } from './subscriptions.controller';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

const subscriptionRepositoryProvider: Provider = {
  provide: SUBSCRIPTION_REPOSITORY,
  useFactory: async (): Promise<SubscriptionRepository> => {
    if (process.env.USE_PRISMA === 'true') {
      const [{ PrismaSubscriptionRepository }, { getPrismaClient }] =
        await Promise.all([
          import('./prisma-subscriptions.repository'),
          import('../prisma/prisma.client'),
        ]);
      return new PrismaSubscriptionRepository(await getPrismaClient());
    }
    return new MemorySubscriptionRepository();
  },
};

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, subscriptionRepositoryProvider],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
