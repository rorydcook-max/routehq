---
title: "HQ Rental Software에서 RoveHQ로 옮기기"
description: "HQ Rental Software의 예약, 차량, 고객을 Excel로 내보내고 RoveHQ로 가져오세요. 무료로 가져와 드려요."
updated: 2026-11-03
exports:
  - "모든 표(예약, 차량, 고객)를 원하는 열로 Excel에"
  - "보고서를 Excel이나 PDF로"
  - "개발자용 API"
steps:
  - "HQ Rental Software에서 ‘Car Rental’ → ‘Reservations’를 열고, 필요하면 필터를 건 뒤 원하는 열을 추가하세요."
  - "표 오른쪽 위 메뉴에서 ‘Actions’ → ‘Export’를 누르세요."
  - "‘Vehicles’와 ‘Customers’에서도 똑같이 하세요."
  - "RoveHQ에서 ‘차량’ → ‘가져오기’를 열고 HQ Rental Software 항목을 고른 뒤 파일을 한꺼번에 올리세요."
faq:
  - q: "HQ의 API가 필요한가요?"
    a: "아니요. Excel 내보내기면 충분해요. API는 개발자가 선호할 때 쓰면 돼요."
---
HQ 지식 베이스에 따르면 시스템의 모든 표와 보고서를 Excel로 내보낼 수 있어요. RoveHQ는 제목 행(픽업과 반납 날짜·장소, 차량 등급, 번호판, 주행거리계)을 보고 HQ의 예약과 차량 내보내기 파일을 알아봐요.

## 상태는 이렇게 옮겨져요

- **Open**과 **Pending** 예약은 다가오는 예약이 돼요.
- **Rental** 예약은 지금 나가 있는 대여가 돼요.
- **Completed** 예약은 지난 대여가 돼요.
- **Quote**, **Cancelled**, **No Show**는 목록에 보이지만, 체크하지 않으면 빠져요.

총 결제액과 보증금은 따로 옮겨지기 때문에, 보관 중인 보증금이 수입으로 잡히는 일은 없어요.

아직 고민 중이신가요? [HQ Rental Software와 RoveHQ 비교](/guides/hq-rental-software-vs-rovehq)를 읽어 보세요.

## 무료 가져오기

가져오기는 모든 요금제에서 무료예요. RoveHQ는 HQ Rental Software 내보내기 파일을 알아보고 바로 읽어요. 저장하기 전에 차량, 예약, 결제 내역을 모두 확인할 수 있고, 30일 안에는 가져오기 전체를 취소할 수 있어요. 직접 하기 번거로우면 [파일을 보내 주세요](/contact). 저희가 대신 가져와 드려요.
