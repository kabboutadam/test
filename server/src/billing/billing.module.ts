import { Module, Provider } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MockPaymentProvider, PAYMENT_PROVIDER } from './payment-provider';
import {
  MemoryPaymentRepository,
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from './payment.repository';

/**
 * Bind the payment provider here. Today it's the mock; to go live, swap in a
 * StripePaymentProvider (or a local gateway) and add its webhook route.
 */
const paymentProvider: Provider = {
  provide: PAYMENT_PROVIDER,
  useClass: MockPaymentProvider,
};

const paymentRepository: Provider = {
  provide: PAYMENT_REPOSITORY,
  useFactory: async (): Promise<PaymentRepository> => {
    if (process.env.USE_PRISMA === 'true') {
      const [{ PrismaPaymentRepository }, { getPrismaClient }] = await Promise.all([
        import('./prisma-payment.repository'),
        import('../prisma/prisma.client'),
      ]);
      return new PrismaPaymentRepository(await getPrismaClient());
    }
    return new MemoryPaymentRepository();
  },
};

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [BillingController],
  providers: [BillingService, paymentProvider, paymentRepository],
})
export class BillingModule {}
