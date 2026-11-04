---
title: "從 Booqable 換到 RoveHQ"
description: "把 Booqable 的訂單、客戶和庫存匯出為 CSV，幾分鐘就能匯入 RoveHQ。我們免費幫你匯入。"
updated: 2026-11-03
exports:
  - "訂單（預訂）匯出為 CSV，在 Orders 清單中操作"
  - "客戶匯出為 CSV"
  - "庫存匯出為 CSV，如果按單件追蹤產品，每件庫存一列"
  - "報表（產品表現、客戶）匯出為 CSV"
steps:
  - "在 Booqable 中開啟 Orders，捲動到清單底部，點選 Export。"
  - "在 Customers 和 Inventory 中也這樣做。"
  - "在 RoveHQ 中開啟「車隊」→「匯入」，選擇 Booqable 並一起上傳這些 CSV 檔案。"
  - "核對找到的內容，然後匯入。"
faq:
  - q: "RoveHQ 會把 Booqable 的押金算作收入嗎？"
    a: "不會。訂單上的押金會記為代收押金，而不是收入。"
  - q: "可以一次匯入多個 Booqable 檔案嗎？"
    a: "可以。把訂單、客戶和庫存一起上傳，RoveHQ 會把它們關聯起來。"
---
Booqable 的匯出檔案是 CSV，頁面上每個欄位一欄，匯出前還可以增刪欄位。RoveHQ 透過標題列識別 Booqable 的訂單、客戶和庫存檔案，直接讀取，不靠猜測。

## 狀態如何對應

- **Reserved**（已預留）訂單變為即將開始的預訂。
- **Started**（已取車）訂單變為正在出租中的租賃。
- **Stopped**（已還車）和 **archived**（已歸檔）訂單變為過去的租賃。
- **Draft**（草稿）和 **cancelled**（已取消）訂單會列出，但除非你勾選，否則不會匯入。

庫存項的標識（通常是車牌或車隊編號）會成為車輛的車牌。訂單按姓名關聯客戶；如果匯出檔案裡有標識，也會關聯車輛。

還在考慮？看看我們的[Booqable 與 RoveHQ 對比](/guides/booqable-vs-rovehq)，或者[適合車輛租賃的 Booqable 替代方案](/guides/booqable-alternatives)。

## 免費匯入

所有方案都可以免費匯入。RoveHQ 能識別 Booqable 的匯出檔案，直接讀取。儲存之前，你能看到每一條車輛、預訂和付款；30 天內還可以撤銷整個匯入。如果不想自己動手，[把檔案傳給我們](/contact)，我們幫你匯入。
