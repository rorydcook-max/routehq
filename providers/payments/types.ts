export type PaymentProviderCode = "cash" | "promptpay" | "bank_transfer_th" | "wise" | "revolut" | "omise" | "stripe" | "manual" | string;

export type CreatePaymentIntentInput = {
  organizationId: string;
  rentalId: string;
  customerId: string;
  vehicleId: string;
  amount: number;
  currency: string;
  dueDate: string;
  metadata?: Record<string, unknown>;
};

export type PaymentIntentResult = {
  provider: PaymentProviderCode;
  providerPaymentId?: string;
  paymentUrl?: string;
  qrPayload?: string;
  status: "scheduled" | "pending" | "paid" | "failed";
  metadata?: Record<string, unknown>;
};

export interface PaymentProvider {
  code: PaymentProviderCode;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  reconcilePayment(providerPaymentId: string): Promise<PaymentIntentResult>;
}
