---
title: "从 HQ Rental Software 换到 RoveHQ"
description: "把 HQ Rental Software 的预订、车辆和客户导出到 Excel，导入 RoveHQ。我们免费帮你导入。"
updated: 2026-11-03
exports:
  - "任何表格（预订、车辆、客户）都能按你选的列导出到 Excel"
  - "报表导出到 Excel 或 PDF"
  - "供开发者使用的 API"
steps:
  - "在 HQ Rental Software 中打开 Car Rental，再打开 Reservations，按需筛选，并加上你需要的列。"
  - "点击表格右上角的菜单，然后选 Actions，再选 Export。"
  - "Vehicles 和 Customers 也这样做。"
  - "在 RoveHQ 中打开“车队”→“导入”，选择 HQ Rental Software 并一起上传这些文件。"
faq:
  - q: "需要用 HQ 的 API 吗？"
    a: "不需要。Excel 导出就够了。如果开发者更喜欢用 API，也可以。"
---
HQ 的知识库说明，系统中的每个表格和报表都能导出到 Excel。RoveHQ 通过表头（取车和还车的日期与地点、车型、车牌、里程表）识别 HQ 的预订和车辆导出文件。

## 状态如何对应

- **Open** 和 **Pending** 预订变为即将开始的预订。
- **Rental** 预订变为正在出租中的租赁。
- **Completed** 预订变为过去的租赁。
- **Quote**、**Cancelled** 和 **No Show** 会列出，但除非你勾选，否则不会导入。

已付总额和押金分开导入，所以你代收的押金永远不会算作收入。

还在考虑？看看我们的[HQ Rental Software 与 RoveHQ 对比](/guides/hq-rental-software-vs-rovehq)。

## 免费导入

所有套餐都可以免费导入。RoveHQ 能识别 HQ Rental Software 的导出文件，直接读取。保存之前，你能看到每一条车辆、预订和付款；30 天内还可以撤销整个导入。如果不想自己动手，[把文件发给我们](/contact)，我们帮你导入。
