---
title: "从 Booqable 换到 RoveHQ"
description: "把 Booqable 的订单、客户和库存导出为 CSV，几分钟就能导入 RoveHQ。我们免费帮你导入。"
updated: 2026-11-03
exports:
  - "订单（预订）导出为 CSV，在 Orders 列表中操作"
  - "客户导出为 CSV"
  - "库存导出为 CSV，如果按单件跟踪产品，每件库存一行"
  - "报表（产品表现、客户）导出为 CSV"
steps:
  - "在 Booqable 中打开 Orders，滚动到列表底部，点击 Export。"
  - "在 Customers 和 Inventory 中也这样做。"
  - "在 RoveHQ 中打开“车队”→“导入”，选择 Booqable 并一起上传这些 CSV 文件。"
  - "核对找到的内容，然后导入。"
faq:
  - q: "RoveHQ 会把 Booqable 的押金算作收入吗？"
    a: "不会。订单上的押金会记为代收押金，而不是收入。"
  - q: "可以一次导入多个 Booqable 文件吗？"
    a: "可以。把订单、客户和库存一起上传，RoveHQ 会把它们关联起来。"
---
Booqable 的导出文件是 CSV，页面上每个字段一列，导出前还可以增删列。RoveHQ 通过表头识别 Booqable 的订单、客户和库存文件，直接读取，不靠猜测。

## 状态如何对应

- **Reserved**（已预留）订单变为即将开始的预订。
- **Started**（已取车）订单变为正在出租中的租赁。
- **Stopped**（已还车）和 **archived**（已归档）订单变为过去的租赁。
- **Draft**（草稿）和 **cancelled**（已取消）订单会列出，但除非你勾选，否则不会导入。

库存项的标识（通常是车牌或车队编号）会成为车辆的车牌。订单按姓名关联客户；如果导出文件里有标识，也会关联车辆。

还在考虑？看看我们的[Booqable 与 RoveHQ 对比](/guides/booqable-vs-rovehq)，或者[适合车辆租赁的 Booqable 替代方案](/guides/booqable-alternatives)。

## 免费导入

所有套餐都可以免费导入。RoveHQ 能识别 Booqable 的导出文件，直接读取。保存之前，你能看到每一条车辆、预订和付款；30 天内还可以撤销整个导入。如果不想自己动手，[把文件发给我们](/contact)，我们帮你导入。
