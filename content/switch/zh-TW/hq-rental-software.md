---
title: "從 HQ Rental Software 換到 RoveHQ"
description: "把 HQ Rental Software 的預訂、車輛和客戶匯出到 Excel，匯入 RoveHQ。我們免費幫你匯入。"
updated: 2026-11-03
exports:
  - "任何表格（預訂、車輛、客戶）都能按你選的欄位匯出到 Excel"
  - "報表匯出到 Excel 或 PDF"
  - "供開發者使用的 API"
steps:
  - "在 HQ Rental Software 中開啟 Car Rental，再開啟 Reservations，按需篩選，並加上你需要的欄位。"
  - "點選表格右上角的選單，然後選 Actions，再選 Export。"
  - "Vehicles 和 Customers 也這樣做。"
  - "在 RoveHQ 中開啟「車隊」→「匯入」，選擇 HQ Rental Software 並一起上傳這些檔案。"
faq:
  - q: "需要用 HQ 的 API 嗎？"
    a: "不需要。Excel 匯出就夠了。如果開發者更喜歡用 API，也可以。"
---
HQ 的知識庫說明，系統中的每個表格和報表都能匯出到 Excel。RoveHQ 透過標題列（取車和還車的日期與地點、車型、車牌、里程錶）識別 HQ 的預訂和車輛匯出檔案。

## 狀態如何對應

- **Open** 和 **Pending** 預訂變為即將開始的預訂。
- **Rental** 預訂變為正在出租中的租賃。
- **Completed** 預訂變為過去的租賃。
- **Quote**、**Cancelled** 和 **No Show** 會列出，但除非你勾選，否則不會匯入。

已付總額和押金分開匯入，所以你代收的押金永遠不會算作收入。

還在考慮？看看我們的[HQ Rental Software 與 RoveHQ 對比](/guides/hq-rental-software-vs-rovehq)。

## 免費匯入

所有方案都可以免費匯入。RoveHQ 能識別 HQ Rental Software 的匯出檔案，直接讀取。儲存之前，你能看到每一條車輛、預訂和付款；30 天內還可以撤銷整個匯入。如果不想自己動手，[把檔案傳給我們](/contact)，我們幫你匯入。
