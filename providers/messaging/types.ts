export type MessagingProviderCode = "whatsapp" | "line" | "messenger" | "email" | "sms" | string;

export type SendMessageInput = {
  organizationId: string;
  customerId?: string;
  channel: MessagingProviderCode;
  recipient: string;
  locale: string;
  templateKey?: string;
  body: string;
  variables?: Record<string, unknown>;
};

export type SendMessageResult = {
  provider: MessagingProviderCode;
  providerMessageId?: string;
  status: "queued" | "sent" | "delivered" | "failed";
  errorMessage?: string;
};

export interface MessagingProvider {
  code: MessagingProviderCode;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
