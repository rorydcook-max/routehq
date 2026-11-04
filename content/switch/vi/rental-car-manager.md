---
title: "Chuyển từ Rental Car Manager sang RoveHQ"
description: "Chạy Bookings Export kèm thanh toán trong Rental Car Manager và đưa lượt đặt xe vào RoveHQ. Chúng tôi nhập miễn phí."
updated: 2026-11-03
exports:
  - "Bookings Export: mọi trường của lượt đặt có trạng thái Reservation, Hired hoặc Returned"
  - "Các khoản thanh toán của mỗi lượt đặt (ngày trả, loại, mã tham chiếu, số tiền, phí cổng thanh toán)"
  - "Excel, CSV hoặc PDF (nên dùng Excel hoặc CSV)"
steps:
  - "Trong Rental Car Manager, vào Reports, rồi Other Reports, rồi Bookings Export."
  - "Chọn All Dates, đánh dấu Include Payments, rồi chạy."
  - "Xuất ra Excel hoặc CSV."
  - "Trong RoveHQ, mở Đội xe, rồi Nhập, chọn Rental Car Manager và tải tệp lên."
---
Rental Car Manager mô tả Bookings Export là bản kết xuất dữ liệu để phân tích trong bảng tính, nên đây là cách chuyển rất tiện. RoveHQ nhận ra nó qua tiêu đề cột.

## Trạng thái được chuyển thế nào

- **Reservation** thành lượt đặt xe sắp tới.
- **Hired** thành lượt thuê đang diễn ra.
- **Returned** thành lượt thuê đã xong.

Các cột bạn ẩn trong báo cáo cũng bị bỏ khỏi tệp xuất, nên hãy hiện tất cả trước khi xuất.

Còn đang cân nhắc? Đọc [so sánh Rental Car Manager và RoveHQ](/guides/rental-car-manager-vs-rovehq).

## Nhập dữ liệu miễn phí

Nhập dữ liệu miễn phí ở mọi gói. RoveHQ nhận ra tệp xuất của Rental Car Manager và đọc ngay. Bạn thấy từng xe, lượt đặt xe và thanh toán trước khi lưu bất cứ thứ gì, và có thể hoàn tác toàn bộ lần nhập trong vòng 30 ngày. Nếu không muốn tự làm, [gửi tệp cho chúng tôi](/contact) và chúng tôi sẽ nhập giúp bạn.
