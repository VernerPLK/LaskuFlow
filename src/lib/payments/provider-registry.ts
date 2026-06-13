import { mockProvider } from './providers/mock-provider';
import { stripeProvider } from './providers/stripe-provider';
import { paytrailProvider, bankTransferProvider, mobilePayProvider, checkoutFinlandProvider, vismaPayProvider } from './providers/stub-providers';

export function resolvePaymentProvider(providerKey: string) {
  switch (providerKey) {
    case 'stripe': return stripeProvider;
    case 'paytrail': return paytrailProvider;
    case 'bank_transfer': return bankTransferProvider;
    case 'mobilepay': return mobilePayProvider;
    case 'checkout_finland': return checkoutFinlandProvider;
    case 'visma_pay': return vismaPayProvider;
    case 'mock':
    default: return mockProvider;
  }
}
