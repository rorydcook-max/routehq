---
title: "Chuyển từ Booqable sang RoveHQ"
description: "Xuất đơn hàng, khách hàng và kho Booqable dạng CSV và đưa vào RoveHQ trong vài phút. Chúng tôi nhập miễn phí."
updated: 2026-11-03
exports:
  - "Đơn hàng (lượt đặt xe) dạng CSV, từ danh sách Orders"
  - "Khách hàng dạng CSV"
  - "Kho dạng CSV, mỗi dòng một món hàng khi sản phẩm được theo dõi"
  - "Báo cáo (hiệu quả sản phẩm, khách hàng) dạng CSV"
steps:
  - "Trong Booqable, mở Orders, cuộn xuống cuối danh sách và bấm Export."
  - "Làm tương tự trong Customers và Inventory."
  - "Trong RoveHQ, mở Đội xe, rồi Nhập, chọn Booqable và tải tất cả tệp CSV lên cùng lúc."
  - "Kiểm tra những gì đã tìm thấy, rồi đưa vào."
faq:
  - q: "RoveHQ có ghi tiền cọc từ Booqable thành doanh thu không?"
    a: "Không. Tiền cọc của một đơn được ghi là tiền cọc đang giữ, không phải doanh thu."
  - q: "Tôi có thể nhập nhiều tệp Booqable cùng lúc không?"
    a: "Có. Tải đơn hàng, khách hàng và kho lên cùng lúc, RoveHQ sẽ liên kết chúng với nhau."
---
Tệp xuất của Booqable là tệp CSV với mỗi trường trên trang là một cột, và bạn có thể thêm hoặc bớt cột trước khi xuất. RoveHQ nhận ra tệp đơn hàng, khách hàng và kho của Booqable qua tiêu đề cột và đọc chính xác, không phải đoán.

## Trạng thái được chuyển thế nào

- Đơn **Reserved** thành lượt đặt xe sắp tới.
- Đơn **Started** (đã nhận xe) thành lượt thuê đang diễn ra.
- Đơn **Stopped** (đã trả xe) và **archived** thành lượt thuê đã xong.
- Đơn **Draft** và **cancelled** được liệt kê nhưng không nhập trừ khi bạn đánh dấu chọn.

Mã của món hàng (thường là biển số hoặc số hiệu xe) trở thành biển số xe. Đơn hàng được liên kết với khách hàng theo tên, và với xe nếu tệp xuất có mã đó.

Còn đang cân nhắc? Đọc [so sánh Booqable và RoveHQ](/guides/booqable-vs-rovehq) hoặc danh sách [các lựa chọn thay thế Booqable cho cho thuê xe](/guides/booqable-alternatives).

## Nhập dữ liệu miễn phí

Nhập dữ liệu miễn phí ở mọi gói. RoveHQ nhận ra tệp xuất của Booqable và đọc ngay. Bạn thấy từng xe, lượt đặt xe và thanh toán trước khi lưu bất cứ thứ gì, và có thể hoàn tác toàn bộ lần nhập trong vòng 30 ngày. Nếu không muốn tự làm, [gửi tệp cho chúng tôi](/contact) và chúng tôi sẽ nhập giúp bạn.
