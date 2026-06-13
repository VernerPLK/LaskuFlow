import type { PaymentProviderAdapter, ProviderKey } from './types';

function integrationReadyProvider(key: ProviderKey, name: string): PaymentProviderAdapter {
  return {
    key,
    name,
    async createPaymentSession() {
      return {
        providerKey: key,
        status: 'requires_action',
        checkoutUrl: null,
        rawProviderPayload: {
          integrationReady: true,
          message: `${name} on valmis yhdistettäväksi, kun API-avaimet ja sopimus ovat käytössä.`,
        },
      };
    },
    async handleWebhook(input) {
      return {
        providerKey: key,
        providerEventId: `${key}_stub_${Date.now()}`,
        eventType: `${key}.webhook.stub`,
        status: 'ignored',
        rawPayload: input.parsedBody ?? input.rawBody,
        errorMessage: `${name} webhook vastaanotettu, mutta provider ei ole vielä live-tilassa.`,
      };
    },
  };
}

export const paytrailProvider = integrationReadyProvider('paytrail', 'Paytrail');
export const bankTransferProvider = integrationReadyProvider('bank_transfer', 'Tilisiirto');
export const mobilePayProvider = integrationReadyProvider('mobilepay', 'MobilePay');
export const checkoutFinlandProvider = integrationReadyProvider('checkout_finland', 'Checkout Finland');
export const vismaPayProvider = integrationReadyProvider('visma_pay', 'Visma Pay');
