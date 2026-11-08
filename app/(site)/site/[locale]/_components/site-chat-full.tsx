"use client";

import { NextIntlClientProvider } from "next-intl";
import { ChatLauncher } from "@/components/chat/chat-launcher";

export type SiteChatFullProps = { locale: string; words: Record<string, string> };

/** The live chat for website visitors, loaded on demand by site-chat.tsx: the launcher with the chat's own words. */
export function SiteChatFull({ locale, words }: SiteChatFullProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={{ chat: words }}>
      <ChatLauncher site />
    </NextIntlClientProvider>
  );
}
