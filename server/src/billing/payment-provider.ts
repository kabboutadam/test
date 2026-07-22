import { Logger } from '@nestjs/common';

/** DI token for the active payment provider. */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface CheckoutSession {
  /** Provider's session/order id the client confirms (or that a webhook keys on). */
  checkoutId: string;
  provider: string;
  /** For real providers: a hosted-payment URL or client secret to complete payment. */
  redirectUrl?: string;
}

export interface ConfirmResult {
  paid: boolean;
  providerRef: string;
}

/**
 * A payment provider. Swap the implementation for a real gateway — Stripe
 * (Checkout + webhook), or a Lebanese gateway such as Areeba — by implementing
 * this interface and binding it in BillingModule. The rest of the billing flow
 * (pending → paid → subscription activation) is provider-agnostic.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: {
    paymentId: string;
    parentId: string;
    planId: 'monthly' | 'yearly';
    amountUsd: number;
  }): Promise<CheckoutSession>;
  /**
   * Confirm a checkout. The mock confirms synchronously; real providers instead
   * confirm asynchronously via a signed webhook — route that to BillingService.
   */
  confirm(checkoutId: string): Promise<ConfirmResult>;
}

/**
 * Dev/mock provider: no real money moves. createCheckout returns a session the
 * app confirms immediately (simulating a completed payment), so the full
 * pending→paid→active flow runs end to end without external services.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockPaymentProvider');

  async createCheckout(input: {
    paymentId: string;
    amountUsd: number;
  }): Promise<CheckoutSession> {
    this.logger.log(`Mock checkout for payment ${input.paymentId} ($${input.amountUsd})`);
    return { checkoutId: `mock_${input.paymentId}`, provider: this.name };
  }

  async confirm(checkoutId: string): Promise<ConfirmResult> {
    return { paid: true, providerRef: `mock_txn_${checkoutId}` };
  }
}
