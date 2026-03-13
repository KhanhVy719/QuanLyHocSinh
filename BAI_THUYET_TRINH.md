# BÀI THUYẾT TRÌNH SẢN PHẨM STEM
## HỆ THỐNG QUẢN LÝ HỌC SINH THÔNG MINH

> **Thời lượng dự kiến:** 8–10 phút  
> **Người trình bày:** Phạm Lê Khánh Vy – Lớp 10A4

---

## 🎬 SLIDE 1 — MỞ ĐẦU (30 giây)

**[Nói:]**

> Kính chào Ban Giám khảo, thầy cô và các bạn!
>
> Em là Phạm Lê Khánh Vy, lớp 10A4. Hôm nay em xin trình bày sản phẩm STEM của em: **"Hệ thống Quản lý Học sinh Thông minh"** — một ứng dụng web tích hợp trí tuệ nhân tạo, giúp số hóa toàn bộ việc quản lý thi đua và hạnh kiểm học sinh.

---

## 📌 SLIDE 2 — VẤN ĐỀ THỰC TẾ (1 phút)

**[Nói:]**

> Trước khi nói về sản phẩm, em xin đặt một câu hỏi: **Các thầy cô mất bao lâu để chấm điểm thi đua và tổng hợp hạnh kiểm cho 45 học sinh mỗi tuần?**
>
> Thực tế tại trường em, quy trình này hoàn toàn **thủ công**:
> - Giáo viên ghi chép trên sổ sách giấy hoặc Excel, mất **15–20 phút mỗi ngày**.
> - Cuối tuần phải tổng hợp thêm **30–45 phút**.
> - Cuối kỳ xếp hạnh kiểm mất **1–2 giờ**.
> - Dễ sai sót, **3–5 lỗi mỗi tuần** khi tính điểm thủ công.
> - Và **phụ huynh hoàn toàn không thể** theo dõi điểm con em mình.
>
> Đây chính là bài toán thực tiễn mà em muốn giải quyết bằng công nghệ.

---

## 💡 SLIDE 3 — GIẢI PHÁP (1 phút)

**[Nói:]**

> Em đã xây dựng một **ứng dụng web** cho phép giáo viên, tổ trưởng và ban giám hiệu quản lý điểm thi đua và hạnh kiểm **hoàn toàn tự động, trực tuyến**.
>
> Sản phẩm có **3 điểm nổi bật**:
>
> 1. **Số hóa toàn bộ quy trình** — Chấm điểm chỉ 2–3 phút/ngày thay vì 15–20 phút.
> 2. **Tích hợp AI phân tích** — Trí tuệ nhân tạo Ollama tự động phân tích xu hướng điểm, phát hiện học sinh cần hỗ trợ.
> 3. **Minh bạch tuyệt đối** — Phụ huynh truy cập link công khai để theo dõi điểm con em **thời gian thực**, không cần đăng nhập.

---

## 🔬 SLIDE 4 — YẾU TỐ STEM (2 phút)

**[Nói:]**

> Sản phẩm thể hiện rõ **4 yếu tố STEM**:

### Khoa học (Science)
> Hệ thống thu thập dữ liệu có hệ thống — mỗi lần chấm điểm đều ghi lại thời gian, lý do, người chấm. Từ đó phân tích **chuỗi thời gian** để nhận diện xu hướng tăng/giảm điểm.
>
> Thuật toán xếp hạnh kiểm dựa trên **ngưỡng điểm khoa học**: Tốt khi ≥ 0, Khá khi ≥ -3, Trung bình khi ≥ -7, và Yếu khi dưới -7.

### Công nghệ (Technology)
> Em sử dụng **React.js 19** cho giao diện, **Supabase** (PostgreSQL) cho cơ sở dữ liệu thời gian thực, và **Ollama** — mô hình AI chạy cục bộ — để phân tích thông minh.
>
> Dữ liệu cập nhật **tức thì** giữa các thiết bị nhờ công nghệ WebSocket.

### Kỹ thuật (Engineering)
> Kiến trúc **Client-Server** với 8 bảng dữ liệu được chuẩn hóa. Hệ thống **phân quyền 3 cấp**: Quản trị viên, Giáo viên, Tổ trưởng — mỗi vai trò chỉ truy cập đúng dữ liệu cần thiết.
>
> Em áp dụng **mô hình Hybrid** sáng tạo: dữ liệu tính toán chính xác phía server, AI chỉ tạo nhận xét ngữ nghĩa — giải quyết vấn đề AI hay trả dữ liệu sai.

### Toán học (Math)
> Thuật toán **xếp hạng** xử lý đồng hạng bằng tiêu chí phụ. **Thống kê mô tả** tính tổng điểm, trung bình theo tổ, theo lớp. **Biểu đồ chuỗi thời gian** thể hiện xu hướng qua tuần, tháng, học kỳ.

---

## 🖥️ SLIDE 5 — DEMO SẢN PHẨM (2 phút)

**[Mở ứng dụng trên máy tính, demo trực tiếp:]**

> Bây giờ em xin demo sản phẩm trực tiếp.

### Demo 1: Đăng nhập & Dashboard
> Đây là trang đăng nhập. Em đăng nhập với tài khoản giáo viên.
> Ngay lập tức thấy **Dashboard tổng quan**: thống kê học sinh, biểu đồ xu hướng, bộ lọc tuần/tháng/học kỳ.

### Demo 2: Chấm điểm thi đua
> Em bấm vào quản lý học sinh. Đây là bảng **xếp hạng tự động** — cộng/trừ điểm cực nhanh, chỉ cần nhập lý do và số điểm. 
> *(Bấm cộng/trừ điểm cho 1 HS)*
> Điểm cập nhật ngay lập tức, xếp hạng tự động thay đổi.

### Demo 3: Xếp hạnh kiểm
> Đây là chức năng mới — **xếp hạnh kiểm theo học kỳ**. Bấm "Xếp lại tất cả" — hệ thống tự động phân loại Tốt/Khá/TB/Yếu dựa trên điểm. Giáo viên có thể chỉnh sửa thủ công nếu cần.

### Demo 4: AI phân tích
> Bây giờ em dùng **AI Ollama** phân tích. Chọn phạm vi "Học kỳ 1", bấm phân tích...
> *(Chờ AI trả kết quả)*
> AI đưa ra nhận xét thông minh: học sinh nào tiến bộ, ai cần cảnh báo, xu hướng chung của lớp.

### Demo 5: Trang công khai
> Cuối cùng — **trang công khai** cho phụ huynh. Giao diện dark mode premium, bảng xếp hạng rõ ràng: Hạng, Tên, Tổ, Hạnh kiểm, Điểm. Bấm vào học sinh nào sẽ thấy lịch sử chi tiết.
> **Không cần đăng nhập** — phụ huynh chỉ cần mở link là xem được.

---

## ✨ SLIDE 6 — TÍNH SÁNG TẠO (1 phút)

**[Nói:]**

> Sản phẩm có những điểm **sáng tạo và độc đáo** sau:
>
> 1. **Tích hợp AI vào quản lý trường học** — rất ít ứng dụng giáo dục nào làm được điều này.
> 2. **Mô hình Hybrid** — sáng tạo kết hợp tính toán server (chính xác) với AI (nhận xét ngữ nghĩa). Đây là giải pháp mà em tự nghĩ ra để khắc phục nhược điểm AI hay bịa dữ liệu.
> 3. **Link công khai không cần đăng nhập** — ý tưởng giúp phụ huynh theo dõi con em dễ dàng, không cần cài app hay tạo tài khoản.
> 4. **Real-time** — khi giáo viên chấm điểm, tổ trưởng thấy ngay trên thiết bị mình.
> 5. **Responsive** — hoạt động tốt trên điện thoại, phù hợp thực tế khi giáo viên thường chấm điểm trên mobile.

---

## 🌍 SLIDE 7 — ỨNG DỤNG THỰC TIỄN (1 phút)

**[Nói:]**

> Sản phẩm đã được **triển khai thử nghiệm thực tế** tại lớp 10A4 và cho kết quả ấn tượng:
>
> | So sánh | Trước | Sau |
> |---------|-------|-----|
> | Chấm điểm | 15–20 phút/ngày | **2–3 phút** |
> | Tổng hợp cuối tuần | 30–45 phút | **Tự động, 0 phút** |
> | Xếp hạnh kiểm | 1–2 giờ | **1 phút** |
> | Sai sót | 3–5 lỗi/tuần | **0 lỗi** |
>
> Giảm **85% thời gian**, loại bỏ **hoàn toàn sai sót**.
>
> Về môi trường: sản phẩm **giảm ~200 tờ giấy/năm/lớp** cho sổ điểm thi đua. Là sản phẩm phần mềm, không sử dụng vật liệu vật lý, không gây ô nhiễm.
>
> Sản phẩm hoàn toàn **mã nguồn mở, miễn phí**, có thể nhân rộng cho mọi trường THPT trên toàn quốc.

---

## 🔮 SLIDE 8 — HƯỚNG PHÁT TRIỂN (30 giây)

**[Nói:]**

> Trong tương lai, em sẽ phát triển thêm:
> - Gửi **thông báo tự động** qua Zalo/email khi học sinh bị cảnh báo
> - Tích hợp **quản lý điểm học tập** (GPA) và xếp loại học lực
> - Chuyển thành **ứng dụng di động PWA** để cài trên điện thoại
> - Mở rộng cho **toàn trường**, hỗ trợ đa lớp, đa năm học

---

## 🙏 SLIDE 9 — KẾT THÚC (30 giây)

**[Nói:]**

> Tóm lại, **"Hệ thống Quản lý Học sinh Thông minh"** là sản phẩm STEM ứng dụng công nghệ web và trí tuệ nhân tạo để giải quyết bài toán thực tiễn trong giáo dục. Sản phẩm đã chứng minh hiệu quả: giảm 85% thời gian, loại bỏ sai sót, và tăng minh bạch.
>
> Em xin cảm ơn Ban Giám khảo đã lắng nghe! Em sẵn sàng trả lời mọi câu hỏi ạ. 🙏

---

## ❓ CÂU HỎI DỰ ĐOÁN & CÁCH TRẢ LỜI

### Q1: "Tại sao chọn Ollama mà không phải ChatGPT?"
> **Trả lời:** Em chọn Ollama vì nó **chạy cục bộ**, không gửi dữ liệu học sinh ra bên ngoài — đảm bảo **bảo mật thông tin**. Ngoài ra, Ollama miễn phí hoàn toàn, không phụ thuộc vào dịch vụ trả phí.

### Q2: "Sản phẩm có khó cài đặt không?"
> **Trả lời:** Không ạ. Em đã đóng gói bằng **Docker** — chỉ cần 1 lệnh `docker compose up` là chạy được. Bất kỳ trường nào có máy tính kết nối internet đều triển khai được.

### Q3: "Nếu nhiều giáo viên chấm điểm cùng lúc thì sao?"
> **Trả lời:** Hệ thống dùng **cơ sở dữ liệu quan hệ PostgreSQL** với cơ chế giao dịch (transaction) — đảm bảo dữ liệu nhất quán dù nhiều người cùng truy cập. Ngoài ra, **Supabase Realtime** đồng bộ thay đổi tức thì giữa các thiết bị.

### Q4: "AI có chính xác không? Nếu AI sai thì sao?"
> **Trả lời:** Đây là câu hỏi rất hay! Em đã giải quyết bằng **mô hình Hybrid**: tất cả dữ liệu số (điểm, xếp hạng, thống kê) được **tính toán chính xác phía server**, AI chỉ **viết nhận xét bằng văn bản** dựa trên dữ liệu đã tính sẵn. Nên dù AI có sai câu chữ, con số vẫn luôn chính xác.

### Q5: "Sản phẩm bảo mật thế nào?"
> **Trả lời:** Mật khẩu được **mã hóa** trước khi lưu. Cơ sở dữ liệu áp dụng **Row Level Security** — mỗi người chỉ xem được dữ liệu thuộc lớp mình. Trang công khai chỉ hiện tên và điểm, **không lộ thông tin nhạy cảm**.

### Q6: "Em tự làm một mình hay có ai hỗ trợ?"
> **Trả lời:** Em tự thiết kế, lập trình và triển khai toàn bộ sản phẩm. Em sử dụng các công nghệ mã nguồn mở miễn phí và tự học qua tài liệu trực tuyến.

### Q7: "Sản phẩm có thể mở rộng cho toàn trường không?"
> **Trả lời:** Có ạ! Kiến trúc hiện tại đã hỗ trợ **đa lớp**. Em chỉ cần thêm tài khoản cho từng giáo viên chủ nhiệm và phân công lớp tương ứng. Hệ thống đám mây Supabase có thể mở rộng phục vụ hàng trăm lớp mà không ảnh hưởng hiệu suất.

### Q8: "Tại sao không dùng Google Sheet đơn giản hơn?"
> **Trả lời:** Google Sheet có thể dùng, nhưng **không có phân quyền chi tiết** (tổ trưởng chỉ xem tổ mình), **không tích hợp AI**, **không có giao diện xếp hạng tự động**, và **không tạo được link công khai đẹp** cho phụ huynh. Sản phẩm của em giải quyết tất cả vấn đề đó.
