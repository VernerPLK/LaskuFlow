export type ProviderKey = 'mock' | 'stripe' | 'paytrail' | 'bank_transfer' | 'mobilepay' | 'checkout_finland' | 'visma_pay';
export type PaymentSessionStatus = 'created' | 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'partially_paid';

export type CreatePaymentSessionInput = {
  organizationId: string;
  invoiceId: string;
  paymentLinkId: string;
  paymentSessionId?: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentSessionResult = {
  providerKey: ProviderKey;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  checkoutUrl?: string | null;
  status: PaymentSessionStatus;
  rawProviderPayload?: unknown;
};

export type PaymentWebhookInput = {
  providerKey: ProviderKey;
  headers: Headers;
  rawBody: string;
  parsedBody?: unknown;
};

export type PaymentWebhookResult = {
  providerKey: ProviderKey;
  providerEventId: string;
  eventType: string;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  paymentSessionId?: string | null;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  invoiceId?: string | null;
  organizationId?: string | null;
  amount?: number | null;
  currency?: string | null;
  sessionStatus?: PaymentSessionStatus;
  shouldCreatePayment?: boolean;
  rawPayload: unknown;
  errorMessage?: string | null;
};

export type RefundResult = { providerRefundId: string; status: string; rawProviderPayload?: unknown };
export type PaymentStatusResult = { status: PaymentSessionStatus; rawProviderPayload?: unknown };

export interface PaymentProviderAdapter {
  key: ProviderKey;
  name: string;
  createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>;
  handleWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookResult>;
  refundPayment?(input: unknown): Promise<RefundResult>;
  getPaymentStatus?(input: unknown): Promise<PaymentStatusResult>;
}
