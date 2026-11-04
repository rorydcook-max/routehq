---
title: Sub-processors
description: The companies RoveHQ uses to store and process personal information, what each one does, where, and the safeguard that protects transfers.
updated: 2026-11-04
order: 4
---

> Written by RoveHQ from public guidance (ICO, EDPB, European Commission, Thai PDPC); not reviewed by a lawyer. This list is Annex 3 of our [data processing agreement](/legal/dpa).

A sub-processor is a company RoveHQ uses that may handle personal information that rental businesses keep in RoveHQ. Each one is bound by a written contract with data protection terms at least as strict as ours.

## Core infrastructure

| Company | What it does for RoveHQ | Where the data is | Transfer safeguard |
|---|---|---|---|
| Supabase, Inc. | Database, sign-in, file storage (ID photos, agreements, vehicle photos) | Singapore (AWS ap-southeast-1) | EU SCCs + UK Addendum in Supabase's DPA |
| Vercel, Inc. | Runs the RoveHQ app and website | Singapore (functions); content cached at Vercel's global edge | EU SCCs + UK Addendum in Vercel's DPA |
| Amazon Web Services | Underlying cloud for Supabase | Singapore | Through Supabase's contract |

## Reading photos with AI

| Company | What it does | Where | Safeguard |
|---|---|---|---|
| Anthropic, PBC | Reads passports, licences, receipts and payment slips (main provider) | United States | EU SCCs + UK Addendum in Anthropic's commercial terms; no training on customer data |
| OpenAI, L.L.C. | Back-up photo reading, used only if Anthropic is unavailable | United States | EU SCCs + UK Addendum in OpenAI's DPA; API data not used for training |
| Google LLC (Gemini API) | Second back-up photo reading | United States / Google's global network | EU SCCs + UK Addendum in Google's data processing terms |

## Messages, email and maps

| Company | What it does | Where | Safeguard |
|---|---|---|---|
| Resend, Inc. *(being added)* | Sends booking and account emails | United States | EU SCCs + UK Addendum in Resend's DPA |
| Google LLC (Maps Platform) | Address search and map pins on booking forms | United States / global | EU SCCs + UK Addendum in Google's terms |
| LY Corporation (LINE) | LINE messages, only for businesses that connect a LINE account | Japan (EU adequacy) | Adequacy decision; LINE's terms |
| Telegram Messenger Inc. | Telegram messages, only for businesses that connect a Telegram bot | United Arab Emirates / global | Telegram's terms *(see note)* |
| Meta Platforms Ireland Ltd (WhatsApp) | WhatsApp messages, only for businesses that connect WhatsApp | EU / United States | Meta's WhatsApp Business terms |

**Note on messaging apps.** A business chooses to connect LINE, Telegram or WhatsApp, and the renter chooses to message on it. Those apps also act as controllers under their own terms with the renter. We list them because RoveHQ passes messages through them for the business.

## Website and app statistics (RoveHQ as controller)

| Company | What it does | Where | Safeguard |
|---|---|---|---|
| Google Ireland Ltd / Google LLC (Google Analytics 4, through Google Tag Manager) | Visit statistics for rovehq.io and rovehq.app (pages used, sign-ups and sign-ins), only after a visitor accepts analytics cookies. Never runs on booking pages or rove.rent and never receives renters' information or anything from businesses' records | EU / United States | EU-US Data Privacy Framework and SCCs |

## Changes to this list

We tell business owners at least **30 days** before we add or replace a sub-processor, by email to the account owner and by updating this page (the date at the top changes). A business that objects on reasonable data protection grounds can tell us at **privacy@rovehq.io** within that time; if we can't resolve it, the business may end its subscription and get a refund of any prepaid, unused time.
