---
title: "Inbox and customer chats"
description: "Connect your LINE Official Account or a Telegram bot, read and answer customer chats in RoveHQ, and show customers how to reach you."
category: daily-work
order: 3
appPath: "/inbox"
related: ["automatic-customer-messages", "customers", "notifications", "business-settings"]
updated: 2026-11-02
faq:
  - q: "Can I connect WhatsApp?"
    a: "Not yet. WhatsApp, Messenger and Instagram need approval from Meta first and are coming next. You can still list your WhatsApp number under How customers reach you."
  - q: "Can I message a customer who has never written to me?"
    a: "Not on LINE or Telegram. They only let you message people who messaged you first. The customer's booking page invites them to open a chat with you. Until then, RoveHQ prepares the message for you to send from your phone."
  - q: "My messages say Not delivered. What do I do?"
    a: "The connection has usually stopped working. Go to Settings > Messaging and paste a new access token. Your chats stay."
---

Customers keep messaging your LINE Official Account or Telegram bot as usual. You read and reply in RoveHQ, with their bookings next to the chat.

## Connect LINE

You need a LINE Official Account. Only the owner can connect it.

1. Go to **Settings** > **Messaging** and tap **Connect LINE Official Account**.
2. Sign in at developers.line.biz and open the Messaging API channel for your Official Account (create one if needed).
3. Copy the **Channel secret** (Basic settings tab) and issue and copy the **Channel access token** (Messaging API tab).
4. Paste both into RoveHQ and tap **Connect**.
5. Back in LINE Developers, switch on "Use webhook" and turn off LINE's auto-reply messages.

## Connect Telegram

1. In **Settings** > **Messaging**, tap **Connect Telegram bot**.
2. In Telegram, message @BotFather, send /newbot and answer the two questions.
3. Paste the token it gives you as the **Bot token** and tap **Connect**.
4. Share your bot's link (t.me/yourbot) with customers.

WhatsApp, Messenger and Instagram can't be connected yet.

## Reply to chats

Open **Inbox**, tap a chat, type and tap **Send**. Their latest bookings show above the messages. **Suggest a reply** drafts an answer from your vehicles, rates and their bookings. Check it before sending.

If a chat says **Not linked to a customer yet**, pick them from **Link to a customer…**. Then automatic messages about their bookings go to this chat.

Done with a chat? Tap **Mark done**. It moves to **Done**, and **Reopen** brings it back.

## Messages to send

Customers who haven't opened a chat with you can't be messaged automatically. Those messages wait at the top of the Inbox. Tap **Open** and use the button to send it from your phone (WhatsApp, LINE and so on).

## Show customers how to reach you

**Settings** > **Business** > **How customers reach you**. Tap the apps you use (WhatsApp, LINE, Messenger, Instagram, Telegram, WeChat, KakaoTalk, Zalo, Viber) and add your number or name. WhatsApp and LINE are printed on your agreements.

## Common questions

**Can I connect WhatsApp?**
Not yet. WhatsApp, Messenger and Instagram need approval from Meta first and are coming next. You can still list your WhatsApp number under **How customers reach you**.

**Can I message a customer who has never written to me?**
Not on LINE or Telegram. They only let you message people who messaged you first. The customer's booking page invites them to open a chat with you. Until then, RoveHQ prepares the message for you to send from your phone.

**My messages say Not delivered. What do I do?**
The connection has usually stopped working. Go to **Settings** > **Messaging** and paste a new access token. Your chats stay.
