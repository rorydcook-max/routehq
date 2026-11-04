---
title: "從 Rental Car Manager 換到 RoveHQ"
description: "在 Rental Car Manager 中執行帶付款的 Bookings Export，把預訂匯入 RoveHQ。我們免費幫你匯入。"
updated: 2026-11-03
exports:
  - "Bookings Export：狀態為 Reservation、Hired 或 Returned 的預訂的全部欄位"
  - "每筆預訂上的付款（付款日期、類型、參考號、金額、商家手續費）"
  - "Excel、CSV 或 PDF（推薦 Excel 或 CSV）"
steps:
  - "在 Rental Car Manager 中進入 Reports，然後 Other Reports，再進入 Bookings Export。"
  - "選擇 All Dates，勾選 Include Payments，然後執行。"
  - "匯出到 Excel 或 CSV。"
  - "在 RoveHQ 中開啟「車隊」→「匯入」，選擇 Rental Car Manager 並上傳檔案。"
---
Rental Car Manager 把 Bookings Export 描述為一份用於在試算表中分析的資料傾印，所以很適合用來遷移。RoveHQ 透過標題列識別它。

## 狀態如何對應

- **Reservation** 變為即將開始的預訂。
- **Hired** 變為正在出租中的租賃。
- **Returned** 變為過去的租賃。

在報表中隱藏的欄位也不會出現在匯出檔案裡，所以匯出前先把所有欄位顯示出來。

還在考慮？看看我們的[Rental Car Manager 與 RoveHQ 對比](/guides/rental-car-manager-vs-rovehq)。

## 免費匯入

所有方案都可以免費匯入。RoveHQ 能識別 Rental Car Manager 的匯出檔案，直接讀取。儲存之前，你能看到每一條車輛、預訂和付款；30 天內還可以撤銷整個匯入。如果不想自己動手，[把檔案傳給我們](/contact)，我們幫你匯入。
