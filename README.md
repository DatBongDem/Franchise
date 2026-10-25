# FranchiseStore API - Node.js Express (SQL Server)

Hệ thống Backend quản lý chuỗi cửa hàng nhượng quyền (Franchise Store), **Node.js (Express + TypeScript)** và sử dụng **SQL Server Local**.

---

## 1. Cấu Trúc Dự Án

```
Franchise/
├── src/
│   ├── config/             # Cấu hình Database SQL Server, JWT, Cloudinary, Env
│   ├── constants/          # StatusEnum (trạng thái đơn hàng), Roles
│   ├── controllers/        # 11 Controllers điều hướng HTTP request
│   ├── middlewares/        # Auth JWT, Role Authorization, Multer Upload
│   ├── routes/             # Định tuyến API
│   ├── services/           # Nghiệp vụ (FIFO Inventory, Order workflow, Recipes, Revenue)
│   ├── app.ts              # Cấu hình Express, CORS, Swagger
│   ├── server.ts           # Khởi động server & kết nối CSDL
│   ├── seed.ts             # Dữ liệu khởi tạo ban đầu
│   └── swagger.ts          # OpenAPI / Swagger UI
├── database/
│   └── schema.sql          # Script DDL SQL Server cho toàn bộ 16 bảng
├── dist/                   # Mã nguồn đã biên dịch sang JavaScript
├── .env                    # Cấu hình môi trường
└── package.json
```

---

## 2. Danh Sách Tài Khoản Mặc Định Đã Tạo Sẵn

Hệ thống đã tự động seed các tài khoản đại diện cho các vai trò:

| Vai trò (Role) | Email (Gmail) | Mật khẩu | Chức năng chính |
|---|---|---|---|
| **ADMIN** | `admin@franchise.com` | `Admin@123` | Quản trị toàn hệ thống, tạo user, store, category, product |
| **STORESTAFF** | `staff@franchise.com` | `Staff@123` | Tạo đơn đặt hàng, bán hàng (FIFO bill), xem lịch sử cửa hàng |
| **KITCHENSTAFF** | `kitchen@franchise.com` | `Kitchen@123` | Nhận đơn nấu, trừ nguyên liệu theo công thức, hoàn thành nấu |
| **SUPPLYCOORDINATOR**| `delivery@franchise.com` | `Delivery@123` | Điều phối nhận đơn, chuyển bếp, giao đến cửa hàng |

---

## 3. Hướng Dẫn Chạy Dự Án

### Chạy ở chế độ Development (tự động reload khi sửa code)
```bash
npm run dev
```

### Build và chạy Production
```bash
npm run build
npm start
```

### Swagger API Documentation
Sau khi khởi động server, truy cập trình duyệt tại:
👉 **http://localhost:5000/swagger**

---

## 4. Cấu Hình Kết Nối SQL Server Local (`.env`)

Mặc định file `.env` đã được cấu hình kết nối tới database `FranchiseDB` trên SQL Server:
```env
PORT=5000

DB_SERVER=localhost
DB_PORT=1433
DB_USER=franchise_user
DB_PASSWORD=Password123!
DB_NAME=FranchiseDB
```

### 💡 Lưu ý khi chuyển sang instance `SQLEXPRESS01`:
Mặc định khi cài đặt SQL Server Express, giao thức **TCP/IP** bị tắt. Để Node.js kết nối trực tiếp đến `SQLEXPRESS01`:
1. Mở **SQL Server Configuration Manager**.
2. Chọn **SQL Server Network Configuration** -> **Protocols for SQLEXPRESS01**.
3. Chuột phải vào **TCP/IP** chọn **Enable**.
4. Khởi động lại dịch vụ **SQL Server (SQLEXPRESS01)**.
5. Trong file `.env`, cập nhật:
   ```env
   DB_SERVER=localhost
   DB_INSTANCE=SQLEXPRESS01
   # bỏ hoặc comment dòng DB_PORT=1433
   ```

---

## 5. Danh Sách 11 Nhóm API 

1. **Users (`/api/users`)**: Login, Logout, /whoami, /me, CRUD người dùng, khóa/mở khóa tài khoản, upload avatar.
2. **Store (`/api/store`)**: CRUD chi nhánh cửa hàng, tự động tạo định mức cho sản phẩm.
3. **Category (`/api/category`)**: CRUD danh mục sản phẩm.
4. **Product (`/api/product`)**: CRUD sản phẩm, xóa mềm, upload ảnh lên Cloudinary, tự động sinh định mức theo cửa hàng.
5. **Order (`/api/order`)**: Quy trình vòng đời đơn hàng (`Creating` -> `Pending` -> `PickedUp` -> `WaitingForCooking` -> `Cooking` -> `Cooked` -> `TakenFrom` -> `Arrived` -> `Completed` / `Canceled`).
6. **Delivery (`/api/delivery`)**: Điều phối viên nhận đơn, gửi bếp, lấy từ bếp, giao đến cửa hàng.
7. **ProductBatches (`/api/productbatches`)**: Thêm/sửa lô hàng trong đơn, theo dõi hạn dùng, thống kê hao hụt (`shrinkage`).
8. **Bills (`/api/bills`)**: Tạo hóa đơn bán lẻ (thuật toán trừ kho **FIFO**), in hóa đơn, báo cáo doanh thu theo chi nhánh.
9. **Ingredient (`/api/ingredient`)**: Quản lý nguyên vật liệu, lịch sử tiêu hao nguyên liệu trong bếp.
10. **Recipe (`/api/recipe`)**: Quản lý công thức món ăn kèm danh sách nguyên liệu và định lượng.
11. **Quantitative (`/api/quantitative`)**: Định mức tồn kho sản phẩm tại từng chi nhánh.
