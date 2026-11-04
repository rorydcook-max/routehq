---
title: "Chuyển từ HQ Rental Software sang RoveHQ"
description: "Xuất lượt đặt chỗ, xe và khách hàng từ HQ Rental Software ra Excel và đưa vào RoveHQ. Chúng tôi nhập miễn phí."
updated: 2026-11-03
exports:
  - "Mọi bảng (lượt đặt chỗ, xe, khách hàng) ra Excel, với các cột bạn chọn"
  - "Báo cáo ra Excel hoặc PDF"
  - "API cho lập trình viên"
steps:
  - "Trong HQ Rental Software, mở Car Rental, rồi Reservations, lọc nếu cần, và thêm các cột bạn muốn."
  - "Bấm vào menu ở góc trên bên phải bảng, rồi Actions, rồi Export."
  - "Làm tương tự với Vehicles và Customers."
  - "Trong RoveHQ, mở Đội xe, rồi Nhập, chọn HQ Rental Software và tải tất cả tệp lên cùng lúc."
faq:
  - q: "Tôi có cần API của HQ không?"
    a: "Không. Tệp xuất Excel là đủ. API dành cho trường hợp lập trình viên muốn dùng."
---
Kho kiến thức của HQ cho biết bạn có thể xuất mọi bảng và báo cáo trong hệ thống ra Excel. RoveHQ nhận ra tệp xuất lượt đặt chỗ và xe của HQ qua tiêu đề cột (ngày và địa điểm nhận, trả xe, hạng xe, biển số, số công-tơ-mét).

## Trạng thái được chuyển thế nào

- Lượt đặt chỗ **Open** và **Pending** thành lượt đặt xe sắp tới.
- Lượt đặt chỗ **Rental** thành lượt thuê đang diễn ra.
- Lượt đặt chỗ **Completed** thành lượt thuê đã xong.
- **Quote**, **Cancelled** và **No Show** được liệt kê nhưng không nhập trừ khi bạn đánh dấu chọn.

Tổng đã trả và tiền cọc được chuyển riêng, nên tiền cọc bạn đang giữ không bao giờ bị tính là doanh thu.

Còn đang cân nhắc? Đọc [so sánh HQ Rental Software và RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Nhập dữ liệu miễn phí

Nhập dữ liệu miễn phí ở mọi gói. RoveHQ nhận ra tệp xuất của HQ Rental Software và đọc ngay. Bạn thấy từng xe, lượt đặt xe và thanh toán trước khi lưu bất cứ thứ gì, và có thể hoàn tác toàn bộ lần nhập trong vòng 30 ngày. Nếu không muốn tự làm, [gửi tệp cho chúng tôi](/contact) và chúng tôi sẽ nhập giúp bạn.
