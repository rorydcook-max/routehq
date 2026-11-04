---
title: "HQ Rental SoftwareからRoveHQへの乗り換え"
description: "HQ Rental Softwareの予約・車両・顧客をExcelにエクスポートして、RoveHQに取り込みましょう。インポートは無料です。"
updated: 2026-11-03
exports:
  - "どの表（予約、車両、顧客）も、選んだ列でExcelへ"
  - "レポートをExcelまたはPDFへ"
  - "開発者向けのAPI"
steps:
  - "HQ Rental Softwareで「Car Rental」→「Reservations」を開き、必要なら絞り込んで、欲しい列を追加します。"
  - "表の右上のメニューから「Actions」→「Export」をクリックします。"
  - "「Vehicles」と「Customers」でも同じようにします。"
  - "RoveHQで「車両」→「インポート」を開き、HQ Rental Softwareを選んでファイルをまとめてアップロードします。"
faq:
  - q: "HQのAPIは必要ですか？"
    a: "いいえ。Excelのエクスポートで十分です。APIは開発者が使いたい場合のためのものです。"
---
HQのナレッジベースによると、システム内のすべての表とレポートをExcelにエクスポートできます。RoveHQは見出し（受け渡しと返却の日付と場所、車両クラス、ナンバー、走行距離計）からHQの予約と車両のエクスポートを認識します。

## ステータスの引き継ぎ方

- **Open**と**Pending**の予約は、今後の予約になります。
- **Rental**の予約は、現在貸出中のレンタルになります。
- **Completed**の予約は、過去のレンタルになります。
- **Quote**、**Cancelled**、**No Show**は一覧に表示されますが、チェックを入れない限り取り込まれません。

支払総額と保証金は別々に引き継がれるので、預かっている保証金が売上として数えられることはありません。

まだ迷っていますか？[HQ Rental SoftwareとRoveHQの比較](/guides/hq-rental-software-vs-rovehq)をご覧ください。

## 無料インポート

インポートはどのプランでも無料です。RoveHQはHQ Rental Softwareのエクスポートを認識して、そのまま読み込みます。保存する前に車両・予約・支払いをすべて確認でき、30日以内ならインポート全体を取り消せます。ご自分でやるのが大変なら、[ファイルを送ってください](/contact)。こちらで取り込みます。
