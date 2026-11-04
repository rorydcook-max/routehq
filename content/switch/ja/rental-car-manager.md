---
title: "Rental Car ManagerからRoveHQへの乗り換え"
description: "Rental Car ManagerのBookings Exportを支払い込みで実行して、予約をRoveHQに取り込みましょう。インポートは無料です。"
updated: 2026-11-03
exports:
  - "Bookings Export：ステータスがReservation、Hired、Returnedの予約の全項目"
  - "各予約に追加された支払い（支払日、種類、参照番号、金額、決済手数料）"
  - "Excel、CSV、PDF（ExcelかCSVがおすすめ）"
steps:
  - "Rental Car Managerで「Reports」→「Other Reports」→「Bookings Export」を開きます。"
  - "「All Dates」を選び、「Include Payments」にチェックを入れて実行します。"
  - "ExcelまたはCSVにエクスポートします。"
  - "RoveHQで「車両」→「インポート」を開き、Rental Car Managerを選んでファイルをアップロードします。"
---
Rental Car Managerは、Bookings Exportをスプレッドシートで分析するためのデータ一括出力だと説明しています。だからこそ移行にぴったりです。RoveHQは見出しからこれを認識します。

## ステータスの引き継ぎ方

- **Reservation**は、今後の予約になります。
- **Hired**は、現在貸出中のレンタルになります。
- **Returned**は、過去のレンタルになります。

レポートで非表示にした列はエクスポートにも含まれないので、エクスポートの前にすべての列を表示しておきましょう。

まだ迷っていますか？[Rental Car ManagerとRoveHQの比較](/guides/rental-car-manager-vs-rovehq)をご覧ください。

## 無料インポート

インポートはどのプランでも無料です。RoveHQはRental Car Managerのエクスポートを認識して、そのまま読み込みます。保存する前に車両・予約・支払いをすべて確認でき、30日以内ならインポート全体を取り消せます。ご自分でやるのが大変なら、[ファイルを送ってください](/contact)。こちらで取り込みます。
