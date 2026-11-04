---
title: "Chuyển từ TWICE Commerce (trước đây là Rentle) sang RoveHQ"
description: "Chuyển đơn hàng, khách hàng và sản phẩm từ TWICE Commerce (trước đây là Rentle) sang RoveHQ. Xuất từng bảng dạng CSV, chúng tôi nhập miễn phí."
updated: 2026-11-04
exports:
  - "Mọi bảng (đơn hàng, khách hàng, sản phẩm và món hàng trong kho) dạng CSV: chế độ xem hiện tại, giữ bộ lọc và các cột đang hiển thị"
  - "Báo cáo Revenue và Payments dạng CSV từ thẻ Export, tối đa 100.000 dòng mỗi báo cáo"
steps:
  - "Trong TWICE, mở Orders, hiện các cột khách hàng, ngày, mặt hàng và giá, rồi xuất chế độ xem đó dạng CSV."
  - "Xuất Customers theo cách tương tự, và cả sản phẩm hoặc món hàng trong kho nếu bạn cần."
  - "Với thanh toán, mở báo cáo Payments và tải CSV từ thẻ Export."
  - "Trong RoveHQ, mở Đội xe, rồi Nhập, chọn TWICE Commerce (trước đây là Rentle) và tải tất cả tệp lên cùng lúc."
---
Rentle giờ có tên là TWICE Commerce. Tài liệu của TWICE cho biết mọi bảng trong trang quản trị đều xuất chế độ xem hiện tại chỉ với một cú bấm, giữ nguyên bộ lọc, cách sắp xếp và các cột đang hiển thị, nên hãy hiện mọi cột bạn cần trước khi xuất.

RoveHQ nhận ra tệp xuất đơn hàng của TWICE (khách hàng, mặt hàng, giá, giai đoạn, kênh bán) và tệp xuất đơn hàng Rentle cũ có cửa hàng, giờ bắt đầu và kết thúc, khách hàng và tổng tiền, rồi đọc mỗi đơn thành một lượt đặt xe. RoveHQ cũng nhận ra báo cáo Payments qua các cột (ngày trả, loại, phương thức, tổng tiền), và đọc mỗi khoản thành tiền vào hoặc tiền ra.

Còn đang cân nhắc? Đọc [so sánh Rentle (nay là TWICE Commerce) và RoveHQ](/guides/rentle-vs-rovehq).

## Nhập dữ liệu miễn phí

Nhập dữ liệu miễn phí ở mọi gói. RoveHQ nhận ra tệp xuất của TWICE Commerce và Rentle và đọc ngay. Bạn thấy từng lượt đặt xe, khách hàng và thanh toán trước khi lưu bất cứ thứ gì, và có thể hoàn tác toàn bộ lần nhập trong vòng 30 ngày. Nếu không muốn tự làm, [gửi tệp cho chúng tôi](/contact) và chúng tôi sẽ nhập giúp bạn.
