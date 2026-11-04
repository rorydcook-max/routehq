---
title: "从 Rental Car Manager 换到 RoveHQ"
description: "在 Rental Car Manager 中运行带付款的 Bookings Export，把预订导入 RoveHQ。我们免费帮你导入。"
updated: 2026-11-03
exports:
  - "Bookings Export：状态为 Reservation、Hired 或 Returned 的预订的全部字段"
  - "每笔预订上的付款（付款日期、类型、参考号、金额、商户手续费）"
  - "Excel、CSV 或 PDF（推荐 Excel 或 CSV）"
steps:
  - "在 Rental Car Manager 中进入 Reports，然后 Other Reports，再进入 Bookings Export。"
  - "选择 All Dates，勾选 Include Payments，然后运行。"
  - "导出到 Excel 或 CSV。"
  - "在 RoveHQ 中打开“车队”→“导入”，选择 Rental Car Manager 并上传文件。"
---
Rental Car Manager 把 Bookings Export 描述为一份用于在电子表格中分析的数据转储，所以很适合用来迁移。RoveHQ 通过表头识别它。

## 状态如何对应

- **Reservation** 变为即将开始的预订。
- **Hired** 变为正在出租中的租赁。
- **Returned** 变为过去的租赁。

在报表中隐藏的列也不会出现在导出文件里，所以导出前先把所有列显示出来。

还在考虑？看看我们的[Rental Car Manager 与 RoveHQ 对比](/guides/rental-car-manager-vs-rovehq)。

## 免费导入

所有套餐都可以免费导入。RoveHQ 能识别 Rental Car Manager 的导出文件，直接读取。保存之前，你能看到每一条车辆、预订和付款；30 天内还可以撤销整个导入。如果不想自己动手，[把文件发给我们](/contact)，我们帮你导入。
