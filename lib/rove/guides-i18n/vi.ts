import { h, p, ul, type GuideTranslations } from "./blocks";

const vi: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Có cần bằng lái quốc tế không? Hướng dẫn theo từng nước",
    description: "Những nước nào yêu cầu du khách có bằng lái quốc tế, chấp nhận phiên bản nào và cần mang theo gì khác ở các điểm thuê xe phổ biến.",
    standfirst: "Bằng lái quốc tế (IDP) là bản dịch giấy phép lái xe của bạn. Có nước bắt buộc, có nước không. Đây là cách nó hoạt động và những gì các điểm đến phổ biến yêu cầu.",
    body: [
      h("IDP là gì và không phải là gì"),
      p("Bằng lái quốc tế dịch giấy phép lái xe của bạn sang một định dạng chuẩn được công nhận theo các công ước quốc tế về giao thông đường bộ. Nó chỉ có giá trị khi đi kèm bằng lái đầy đủ ở nước bạn, và chỉ cho những hạng xe mà bằng lái đó cho phép. Bạn làm IDP trước chuyến đi, tại nước đã cấp bằng lái cho bạn."),
      p("Có ba phiên bản, đặt theo tên các công ước làm nền tảng: 1926, 1949 và 1968. Mỗi nước chấp nhận phiên bản (hoặc các phiên bản) của những công ước mà nước đó tham gia, nên loại phù hợp tùy thuộc vào nơi bạn đến."),
      h("Các điểm đến phổ biến yêu cầu gì"),
      ul([
        "Liên minh châu Âu: bằng lái từ một nước EU hoặc EEA có giá trị trên toàn EU. Du khách từ nơi khác nên kiểm tra từng nước; chính phủ Anh xếp Bồ Đào Nha, Hy Lạp, Ý và Croatia theo công ước 1968, còn Tây Ban Nha và Malta theo công ước 1949.",
        "Nhật Bản: chỉ chấp nhận IDP bản giấy theo Công ước Geneva 1949. Bằng lái của Thụy Sĩ, Đức, Pháp, Bỉ, Monaco và Đài Loan thay vào đó được dùng kèm bản dịch tiếng Nhật được ủy quyền. Bạn được lái xe tối đa một năm kể từ khi đến.",
        "Hoa Kỳ: du khách thường được lái bằng bằng lái của nước mình, nhưng quy định khác nhau theo từng bang và có thể cần IDP (phiên bản 1949). Hãy kiểm tra từng bang bạn sẽ lái xe, cùng quy định của bên cho thuê.",
        "New Zealand: bạn có thể lái xe bằng bằng lái nước ngoài còn hiệu lực trong một thời gian giới hạn; nếu bằng không bằng tiếng Anh, hãy mang theo bản dịch tiếng Anh được chấp thuận.",
        "Costa Rica: bằng lái còn hiệu lực của nước bạn dùng được trong suốt thời gian lưu trú du lịch, thường tối đa 90 ngày.",
        "Các Tiểu vương quốc Ả Rập Thống nhất: du khách từ hơn 30 nước có thể lái xe bằng bằng lái của nước mình khi dùng thị thực du lịch; những người khác cần IDP.",
        "Maroc: theo chính phủ Anh, tài xế Anh cần IDP 1968, và phiên bản 1949 không còn được chấp nhận.",
        "Thái Lan và Indonesia: du khách cần IDP cùng với bằng lái, và với xe tay ga thì cả hai phải bao gồm hạng mô tô. Xem các hướng dẫn của chúng tôi về Thái Lan và Bali."
      ]),
      h("Bên cho thuê có thể yêu cầu thêm"),
      p("Ngay cả ở nơi luật không bắt buộc IDP, bên cho thuê vẫn có thể yêu cầu, cùng với độ tuổi tối thiểu hoặc kinh nghiệm lái xe từ một năm trở lên. Nếu một doanh nghiệp trên Rove cần giấy tờ, họ sẽ báo khi xác nhận đặt xe của bạn."),
      h("Xe tay ga và mô tô"),
      p("Bằng lái ô tô không tự động bao gồm xe tay ga. Ví dụ ở Hy Lạp, bạn cần ít nhất hạng A1 (mô tô hạng nhẹ) để thuê xe máy. Lái xe không đúng bằng còn có thể khiến bảo hiểm du lịch không chi trả sau tai nạn.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Bảo hiểm thuê xe: CDW, mức miễn thường và tiền cọc",
    description: "CDW bảo hiểm những gì, mức miễn thường là gì, vì sao tiền cọc bị tạm giữ trên thẻ và cách tránh phí bất ngờ khi thuê ô tô hoặc xe máy ở nước ngoài.",
    standfirst: "Bảo hiểm thuê xe đầy những từ viết tắt. Đây là ý nghĩa của CDW, mức miễn thường và tiền cọc, cùng những điều cần kiểm tra trước khi ký.",
    body: [
      h("Bảo hiểm trách nhiệm dân sự"),
      p("Bảo hiểm trách nhiệm chi trả cho thiệt hại hoặc thương tích bạn gây ra cho người khác. Ở EU, mọi xe cho thuê đều bắt buộc có loại này, thường đã gồm trong giá. Ở UAE, bảo hiểm bên thứ ba được bao gồm theo luật. Ở Mexico, bắt buộc phải có bảo hiểm trách nhiệm của một công ty bảo hiểm Mexico, và hợp đồng bảo hiểm của Mỹ hay Canada không có giá trị ở đó."),
      h("CDW (miễn trừ thiệt hại do va chạm) và mức miễn thường"),
      p("CDW giới hạn số tiền bạn phải trả nếu chính chiếc xe thuê bị hư hỏng, nhưng hiếm khi xóa hết chi phí. Phần còn lại là mức miễn thường (excess): số tiền tối đa bạn phải trả cho hư hỏng. CDW thường không bao gồm lốp và kính, nên hãy kiểm tra CDW của bạn bảo hiểm những gì."),
      p("Bên cho thuê thường bán thêm gói giảm mức miễn thường (đôi khi xuống bằng không). Gói này có thể đắt. Bảo hiểm miễn thường độc lập thường rẻ hơn, nhưng bạn phải trả cho bên cho thuê trước rồi mới đòi lại tiền."),
      h("Tiền cọc"),
      p("Tiền cọc thường là khoản tạm giữ trên thẻ tín dụng đứng tên người lái. Bạn không thể tiêu số tiền đó khi nó đang bị giữ, và khoản này được giải phóng khi xe được trả lại mà không có hư hỏng, tiền phạt hay phí cầu đường chưa trả. Ví dụ ở UAE, khoản này phải được giải phóng trong vòng 30 ngày. Trên Rove, mỗi xe đều hiển thị tiền cọc trước khi bạn đặt."),
      h("Tránh phí bất ngờ"),
      ul([
        "Trước khi lái đi, hãy đi một vòng quanh xe cùng bên cho thuê và chụp ảnh hoặc quay video từ mọi phía, cả bên trong và mức nhiên liệu. Đảm bảo mọi hư hỏng đều được ghi vào biên bản bàn giao.",
        "Kiểm tra chính sách nhiên liệu, giới hạn số km nếu có, và giá của các dịch vụ thêm như ghế trẻ em.",
        "Giữ bản sao hợp đồng và biên bản nhận xe, trả xe.",
        "Nếu tranh chấp với một doanh nghiệp ở nước EU khác không đi đến đâu, Trung tâm Người tiêu dùng châu Âu tại nước bạn có thể hỗ trợ miễn phí."
      ]),
      h("Xe tay ga và xe địa hình bốn bánh"),
      p("Bảo hiểm bán kèm xe tay ga và xe địa hình bốn bánh (ATV) thường chỉ là bảo hiểm bên thứ ba, nên bạn phải tự trả cho hư hỏng của chính chiếc xe. Nhiều gói bảo hiểm du lịch loại trừ việc lái ATV, và lái xe không đúng bằng có thể làm mất hiệu lực bảo hiểm.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Thuê ô tô ở châu Âu: bằng lái, phí đường bộ, vùng hạn chế",
    description: "Du khách cần gì để thuê và lái ô tô ở châu Âu: bằng lái và độ tuổi, thu phí điện tử, khu ZTL ở Ý, trang bị bắt buộc, nồng độ cồn và bảo hiểm.",
    standfirst: "Quy định ở châu Âu khác nhau giữa các nước. Đây là những quy định khiến du khách vướng phải nhiều nhất.",
    body: [
      h("Bằng lái và độ tuổi"),
      p("Bằng lái từ một nước EU hoặc EEA có giá trị trên toàn EU. Nếu bằng lái của bạn từ nơi khác, hãy kiểm tra từng nước bạn sẽ lái xe; một số nước yêu cầu bằng lái quốc tế. Độ tuổi tối thiểu để lái ô tô là 18 ở Bồ Đào Nha, Tây Ban Nha, Hy Lạp, Ý và Croatia, nhưng bên cho thuê thường đặt mức riêng (ở Malta thường là 21) và có thể tính phí cao hơn cho người dưới 25 tuổi."),
      h("Phí đường bộ và khu vực trong thành phố"),
      ul([
        "Bồ Đào Nha: một số đường cao tốc chỉ thu phí điện tử. Hãy hỏi xem xe có thiết bị thu phí tự động không.",
        "Ý: nhiều trung tâm thành phố là khu hạn chế giao thông (ZTL) có camera giám sát. Đi vào mà không có giấy phép sẽ bị phạt, và giấy phạt thường được gửi sau qua bên cho thuê.",
        "Tây Ban Nha: một số thành phố có khu phát thải thấp, và Barcelona yêu cầu xe nước ngoài đăng ký trước."
      ]),
      h("Những thứ xe phải có"),
      p("Ở Croatia, mọi ô tô đều phải có biển cảnh báo tam giác, bộ sơ cứu và áo phản quang. Hãy kiểm tra chúng có trong xe khi nhận xe. Luôn mang theo bằng lái và giấy tờ tùy thân khi lái xe; ở Bồ Đào Nha đây là quy định bắt buộc."),
      h("Trên đường"),
      ul([
        "Mọi nơi đều đi bên phải, trừ Malta, Síp, Ireland và Anh.",
        "Giới hạn nồng độ cồn thông thường ở Bồ Đào Nha, Tây Ban Nha và Hy Lạp là 0,05%, thấp hơn với tài xế mới.",
        "Ở Tây Ban Nha, dùng điện thoại khi lái xe là phạm luật ngay cả khi đã dừng bên lề đường, và trẻ em cao dưới 1,35 m phải ngồi ghế trẻ em."
      ]),
      h("Bảo hiểm"),
      p("Bảo hiểm trách nhiệm dân sự đã gồm trong mọi hợp đồng thuê xe ở EU. Hư hỏng của chính chiếc xe thường được CDW kèm mức miễn thường chi trả; xem hướng dẫn của chúng tôi về CDW, mức miễn thường và tiền cọc.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Thuê xe tay ga hoặc ATV ở Hy Lạp",
    description: "Bằng lái cần có để thuê xe máy, xe tay ga hoặc ATV ở Hy Lạp, quy định và mức phạt về mũ bảo hiểm, lỗ hổng bảo hiểm và mẹo an toàn trên các đảo.",
    standfirst: "Xe tay ga và ATV có mặt khắp nơi trên các đảo Hy Lạp. Quy định về bằng lái chặt hơn nhiều du khách nghĩ.",
    body: [
      h("Bằng lái bạn cần"),
      p("Để thuê xe máy hoặc xe tay ga ở Hy Lạp, bạn cần bằng lái còn hiệu lực có ít nhất hạng A1 (mô tô hạng nhẹ). Chỉ có bằng lái ô tô là không đủ, và hạng P của Anh dành cho xe máy đến 50 cc không có giá trị ở Hy Lạp. Bằng lái tạm thời không có giá trị với bất kỳ loại xe nào."),
      h("Mũ bảo hiểm"),
      p("Người lái và người ngồi sau trên xe máy và ATV đều phải đội mũ bảo hiểm. Nếu cảnh sát dừng bạn khi không đội mũ, bạn sẽ bị phạt và bị tạm giữ bằng lái, và lái xe không đội mũ có thể làm mất hiệu lực bảo hiểm."),
      h("ATV: hãy đặc biệt cẩn thận"),
      ul([
        "ATV gây ra nhiều ca chấn thương nặng và tử vong mỗi năm. Hãy được hướng dẫn đầy đủ trước khi lái, và nhớ rằng bạn đang dùng chung đường với xe lớn hơn, nhanh hơn.",
        "Bảo hiểm bán kèm ATV thường chỉ là bảo hiểm bên thứ ba: bên cho thuê nhiều khả năng sẽ tính tiền bạn cho mọi hư hỏng của chính chiếc ATV.",
        "Nhiều gói bảo hiểm du lịch coi lái ATV là môn thể thao mạo hiểm và loại trừ nó. Hãy đọc hợp đồng bảo hiểm trước khi lái."
      ]),
      h("Trên đường"),
      ul([
        "Hy Lạp đi bên phải.",
        "Giao thông có thể nhanh và hỗn loạn, và tài xế không phải lúc nào cũng dừng ở vạch qua đường.",
        "Lái xe khi say rượu là vi phạm nghiêm trọng, có thể bị phạt tiền và phạt tù."
      ]),
      h("Trước khi lái đi"),
      ul([
        "Kiểm tra xe trong tình trạng tốt: phanh, lốp và đèn.",
        "Chụp ảnh xe cùng bên cho thuê, kể cả các hư hỏng sẵn có, và thống nhất tiền cọc cùng giờ trả xe."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Thuê xe tay ga ở Thái Lan: bằng lái, mũ và bảo hiểm",
    description: "Những gì bạn cần để lái xe tay ga thuê hợp pháp ở Thái Lan: đúng bằng lái và IDP, quy định và mức phạt về mũ bảo hiểm, tiền cọc và bảo hiểm.",
    standfirst: "Xe tay ga là cách đi lại dễ nhất trên hầu hết các đảo của Thái Lan. Đây là những gì bạn cần để lái hợp pháp và những điều cần kiểm tra trước khi đi.",
    body: [
      h("Bằng lái bạn cần"),
      p("Để lái xe tay ga hoặc mô tô ở Thái Lan với tư cách du khách, bạn cần bằng lái có hạng mô tô, cùng với bằng lái quốc tế (IDP) ghi rõ hạng mô tô. Chỉ có bằng lái ô tô thì không được lái xe tay ga, dù cửa hàng cho thuê có nói gì đi nữa."),
      p("Chính phủ Thái Lan nêu IDP cấp theo Công ước Geneva 1949, và bằng lái từ các nước ASEAN khác cũng được chấp nhận. Chính phủ Anh khuyên tài xế Anh mang phiên bản 1968. Hãy làm IDP ở nước bạn trước chuyến đi: bạn không thể làm khi đã ở Thái Lan."),
      h("Mũ bảo hiểm là bắt buộc, cho cả hai người"),
      p("Cả người lái và người ngồi sau đều phải đội mũ bảo hiểm theo điều 122 của Luật Giao thông Đường bộ (Land Traffic Act). Cảnh sát có thể phạt đến 2.000 baht, và việc kiểm tra đã được tăng cường trên toàn quốc từ ngày 1 tháng 6 năm 2025. Hãy xin bên cho thuê mũ vừa đầu cho bạn và người đi cùng."),
      h("Bảo hiểm: được chi trả gì và không được gì"),
      ul([
        "Mọi xe đã đăng ký đều phải có bảo hiểm bắt buộc (Por Ror Bor). Bảo hiểm này chi trả cho thương tích và tử vong, nhưng không chi trả hư hỏng xe hay tài sản của người khác.",
        "Hãy hỏi bên cho thuê xe còn được bảo hiểm những gì khác, và bạn phải trả bao nhiêu nếu xe bị hư hỏng hoặc bị mất cắp.",
        "Kiểm tra bảo hiểm du lịch của bạn có chi trả khi lái mô tô không. Nhiều hợp đồng chỉ chi trả nếu bạn có đúng bằng lái cho loại xe đó, nên không có bằng bạn có thể không được bảo hiểm."
      ]),
      h("Tiền cọc"),
      p("Hãy chuẩn bị để lại tiền cọc, được hoàn lại khi bạn trả xe trong tình trạng như cũ. Đừng giao hộ chiếu làm tiền cọc hay vật đảm bảo: chính phủ Anh và Úc đều cảnh báo điều này. Trên Rove, mỗi xe đều hiển thị tiền cọc trước khi bạn đặt."),
      h("Trước khi lái đi"),
      ul([
        "Đi một vòng quanh xe cùng bên cho thuê và chụp lại các vết xước, vết móp để không ai tranh cãi về chúng sau này.",
        "Kiểm tra phanh, lốp, đèn và còi, và giấy đăng ký cùng giấy bảo hiểm có đi kèm xe.",
        "Thống nhất về xăng, giờ trả xe và người cần gọi nếu xe hỏng.",
        "Lưu số điện thoại hoặc kênh chat của bên cho thuê trước khi đi."
      ]),
      h("Trên đường"),
      ul([
        "Thái Lan đi bên trái.",
        "Thái Lan có tỷ lệ tử vong do tai nạn giao thông thuộc hàng cao nhất thế giới, và người đi mô tô có nguy cơ cao nhất. Hãy lái xe phòng thủ và đặc biệt cẩn thận khi trời mưa.",
        "Các dịp lễ như Songkran có nhiều xe cộ hơn và nhiều người uống rượu hơn. Không bao giờ lái xe sau khi uống rượu bia."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Bằng lái quốc tế cho Thái Lan",
    description: "Bạn có cần bằng lái quốc tế để lái ô tô hoặc xe tay ga ở Thái Lan không? Nên làm loại nào, làm ở đâu và cần mang theo gì.",
    standfirst: "Hầu hết du khách cần bằng lái quốc tế để lái xe ở Thái Lan. Đây là loại cần làm, nơi làm và những gì cần mang theo.",
    body: [
      h("IDP là gì"),
      p("Bằng lái quốc tế là bản dịch giấy phép lái xe của bạn theo định dạng chuẩn, được công nhận theo các thỏa thuận quốc tế. Nó không thay thế bằng lái của bạn; bạn phải mang theo cả hai suốt thời gian lái xe."),
      h("Ở Thái Lan có cần không?"),
      p("Có, trừ khi bạn có bằng lái Thái Lan hoặc bằng lái của một nước ASEAN khác. Chính phủ Thái Lan nêu IDP theo Công ước Geneva 1949. Chính phủ Anh yêu cầu tài xế Anh mang phiên bản 1968 khi đến Thái Lan, vì vậy hãy hỏi cơ quan cấp bằng lái của bạn xem họ cấp loại nào cho Thái Lan."),
      p("Không có bằng lái hợp lệ, bạn có thể bị phạt, và bảo hiểm du lịch có thể từ chối bồi thường sau tai nạn. Chính phủ Úc cảnh báo rằng lái xe không đúng bằng có thể dẫn đến bị bắt giữ."),
      h("Xe tay ga và mô tô"),
      p("IDP chỉ có giá trị cho những gì bằng lái ở nước bạn cho phép. Để lái xe tay ga hoặc mô tô, cả hai đều phải có hạng mô tô; bằng lái và IDP chỉ có hạng ô tô thì không được lái xe tay ga."),
      h("Làm ở đâu"),
      p("IDP được cấp tại nước đã cấp bằng lái cho bạn, trước chuyến đi: bạn không thể làm khi đã ở Thái Lan. Ví dụ ở Anh, IDP được bán trực tiếp tại các cửa hàng có dịch vụ PayPoint, với giá 5,50 bảng Anh."),
      h("Cần mang theo gì"),
      ul([
        "Bằng lái đầy đủ ở nước bạn (bằng lái điện tử có thể không được chấp nhận).",
        "IDP của bạn.",
        "Hộ chiếu hoặc bản sao, và giấy tờ xe, do bên cho thuê để sẵn trong xe."
      ]),
      h("Ở lâu hơn?"),
      p("Nếu bạn sống ở Thái Lan, bạn có thể xin cấp bằng lái Thái Lan. Chính phủ Thái Lan cũng mô tả loại giấy phép tạm thời 30 ngày cho du khách có bằng lái không sử dụng được, do Văn phòng Giao thông Đường bộ cấp tỉnh (Provincial Land Transport Office) cấp.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Thuê ô tô theo tháng ở Thái Lan: cách hoạt động",
    description: "Cách thuê ô tô và xe tay ga theo tháng ở Thái Lan: giá so với giá theo ngày, tiền cọc, gia hạn mỗi tháng và những điều cần kiểm tra.",
    standfirst: "Ở lại một tháng hoặc lâu hơn? Thuê theo tháng từ một doanh nghiệp địa phương thường rẻ hơn nhiều tính theo ngày so với thuê từng ngày.",
    body: [
      h("Vì sao nên thuê theo tháng"),
      p("Các doanh nghiệp cho thuê địa phương ở Thái Lan thường có giá theo tháng thấp hơn nhiều tính theo ngày so với giá thuê ngày, vì thuê dài giúp họ đỡ phải bàn giao, vệ sinh và có ngày xe nằm không. Nếu bạn ở lại từ ba tuần trở lên, hãy so sánh cả hai trước khi đặt."),
      h("Cách hoạt động trên Rove"),
      ul([
        "Chọn “Theo tháng, không có ngày kết thúc” trong tìm kiếm để xem giá theo tháng. Hợp đồng thuê tháng không có ngày kết thúc sẽ tiếp tục từng tháng cho đến khi bạn báo dừng.",
        "Chọn ngày kết thúc nếu bạn biết khi nào rời đi: Rove hiển thị tổng số tiền chính xác cho các ngày của bạn, tính theo cách doanh nghiệp tính phí.",
        "Đặt xe của bạn được gửi thẳng đến doanh nghiệp. Họ xác nhận việc bàn giao với bạn, và bạn thanh toán cho họ theo điều khoản ghi trên trang của họ."
      ]),
      h("Tiền cọc"),
      p("Thuê theo tháng thường kèm tiền cọc, được hoàn lại khi xe được trả trong tình trạng như cũ. Trên Rove, mỗi xe đều hiển thị tiền cọc trước khi bạn đặt. Đừng giao hộ chiếu làm tiền cọc: khuyến cáo du lịch chính thức cảnh báo điều này."),
      h("Những điều cần kiểm tra trước khi ký"),
      ul([
        "Điều gì xảy ra vào cuối mỗi tháng: bạn thanh toán như thế nào và khi nào, và cần báo trước bao lâu khi muốn dừng.",
        "Xe được bảo hiểm những gì. Bảo hiểm bắt buộc (Por Ror Bor) chỉ chi trả thương tích và tử vong, không chi trả hư hỏng xe.",
        "Ai trả chi phí bảo dưỡng và sửa chữa trong thời gian thuê dài, và phải làm gì nếu xe hỏng.",
        "Bạn có được mang xe ra khỏi đảo hay ra ngoài tỉnh không, và có giới hạn số km không.",
        "Giao xe và nhận lại xe có được bao gồm không."
      ]),
      h("Bằng lái vẫn quan trọng"),
      p("Du khách cần bằng lái của nước mình cùng bằng lái quốc tế để lái xe ở Thái Lan. Nếu bạn sống ở Thái Lan, bạn có thể xin cấp bằng lái Thái Lan thay thế.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Thuê xe tay ga ở Bali",
    description: "Những gì bạn cần để thuê và lái xe tay ga ở Bali: bằng lái quốc tế, mũ bảo hiểm, kiểm tra của cảnh sát, bảo hiểm và các quy định mới nhất cho du khách.",
    standfirst: "Ở Bali xe tay ga có mặt khắp nơi, và các chốt kiểm tra của cảnh sát cũng vậy. Đây là những gì bạn cần để lái xe hợp pháp và an toàn.",
    body: [
      h("Bằng lái bạn cần"),
      p("Ở Indonesia, chỉ có bằng lái của nước bạn là chưa đủ: bạn cần bằng lái quốc tế (hoặc bằng lái Indonesia), và phải có hạng mô tô. Hãy làm IDP ở nước bạn trước chuyến đi."),
      p("Cảnh sát có kiểm tra thật. Vào tháng 5 năm 2025, một đợt ra quân ba ngày ở Badung, khu vực gồm Canggu, Kuta, Seminyak và Uluwatu, đã lập biên bản 81 người lái xe, trong đó có 30 du khách, và tạm giữ 56 phương tiện."),
      h("Quy định cho du khách có thể thay đổi"),
      p("Chính quyền tỉnh Bali đã đề xuất cấm du khách lưu trú ngắn ngày thuê xe máy để tự lái. Theo lần kiểm tra gần nhất của chúng tôi, đây vẫn là đề xuất, chưa phải quy định có hiệu lực. Hãy hỏi doanh nghiệp về tình hình hiện tại trước khi đặt."),
      h("Mũ bảo hiểm"),
      p("Hãy đội mũ bảo hiểm còn tốt mỗi lần lái xe, và đảm bảo người ngồi sau cũng có mũ."),
      h("Bảo hiểm"),
      p("Kiểm tra bảo hiểm du lịch của bạn có chi trả khi lái mô tô ở Indonesia với bằng lái bạn đang có không. Lái xe không đúng bằng, hoặc không tuân thủ quy định, có thể khiến yêu cầu bồi thường bị từ chối."),
      h("Trên đường"),
      ul([
        "Indonesia đi bên trái.",
        "Giao thông đông đúc và khó đoán, nhất là ở phía nam. Nếu bạn chưa tự tin lái xe máy, thuê ô tô kèm tài xế có thể phù hợp hơn.",
        "Nếu gặp tai nạn, hãy chờ cảnh sát tại hiện trường và trình báo tại đồn cảnh sát.",
        "Vào ngày Nyepi, ngày im lặng của Bali, mọi hoạt động đi lại trên đảo dừng lại suốt cả ngày."
      ]),
      h("Trước khi lái đi"),
      ul([
        "Chụp ảnh xe cùng doanh nghiệp, kể cả các hư hỏng sẵn có.",
        "Kiểm tra phanh, lốp và đèn, và thống nhất tiền cọc, xăng cùng giờ trả xe.",
        "Lưu số điện thoại hoặc kênh chat của doanh nghiệp."
      ])
    ]
  }
};

export default vi;
