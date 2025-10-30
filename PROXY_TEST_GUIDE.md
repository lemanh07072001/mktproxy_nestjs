# Hướng dẫn Test Hệ thống Proxy Xoay

## Chuẩn bị

### 1. Đảm bảo có dữ liệu proxy trong database

Kết nối MongoDB và thêm một số proxy mẫu:

```javascript
// Kết nối MongoDB shell hoặc sử dụng MongoDB Compass
use your_database_name;

// Thêm proxy mẫu
db.proxies.insertMany([
  {
    host: "192.168.1.1",
    port: 8080,
    user: "user1",
    pass: "pass1"
  },
  {
    host: "192.168.1.2",
    port: 8080,
    user: "user2",
    pass: "pass2"
  },
  {
    host: "192.168.1.3",
    port: 8080,
    user: "user3",
    pass: "pass3"
  },
  {
    host: "192.168.1.4",
    port: 8080
  },
  {
    host: "192.168.1.5",
    port: 8080
  }
]);
```

### 2. Đảm bảo Redis đang chạy

```bash
# Kiểm tra Redis
redis-cli ping
# Kết quả mong đợi: PONG
```

### 3. Khởi động server

```bash
npm run start:dev
```

---

## Các API Endpoints

### 1. **Mua Key Proxy** (Public - Không cần token)

**Endpoint:** `POST /api/proxies/buy-key`

**Headers:**
```
Content-Type: application/json
```

**Lưu ý:** API này không cần authentication, tất cả key được tạo sẽ gán cho user_id = 16011

**Body:**
```json
{
  "quantity": 3,
  "time": 30
}
```

**Tham số:**
- `quantity` (optional): Số lượng key muốn mua (1-100). Mặc định: 1
- `time` (optional): Số ngày hiệu lực (1-365). Mặc định: 30

**Response thành công (mua 3 key):**
```json
{
  "success": true,
  "message": "Tạo 3 key thành công",
  "total": 3,
  "data": [
    {
      "key": "D8f3Y1MSh4lG7k_tFmwOkg",
      "expired_at": 1738195200,
      "expired_date": "2025-11-30 12:00:00"
    },
    {
      "key": "X9g4Z2NTi5mH8l_uGnxPlh",
      "expired_at": 1738195200,
      "expired_date": "2025-11-30 12:00:00"
    },
    {
      "key": "A1b2C3dE4fG5hI6jK7lM8n",
      "expired_at": 1738195200,
      "expired_date": "2025-11-30 12:00:00"
    }
  ]
}
```

**Test với cURL:**

Mua 1 key (mặc định 30 ngày):
```bash
curl -X POST http://localhost:3000/api/proxies/buy-key \
  -H "Content-Type: application/json" \
  -d '{}'
```

Mua 3 key, hiệu lực 30 ngày:
```bash
curl -X POST http://localhost:3000/api/proxies/buy-key \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3, "time": 30}'
```

Mua 5 key, hiệu lực 7 ngày:
```bash
curl -X POST http://localhost:3000/api/proxies/buy-key \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5, "time": 7}'
```

---

### 2. **Lấy Proxy (Tự động xoay mỗi 60s)** (Public)

**Endpoint:** `GET /api/proxies/get/:key`

**Response lần đầu (proxy mới):**
```json
{
  "success": true,
  "proxy": "192.168.1.1:8080:user1:pass1",
  "ip": "192.168.1.1",
  "port": 8080,
  "user": "user1",
  "pass": "pass1",
  "message": "Proxy mới đã được xoay",
  "timeRemaining": 60
}
```

**Response trong vòng 60s (proxy cũ - ví dụ còn 45s):**
```json
{
  "success": true,
  "proxy": "192.168.1.1:8080:user1:pass1",
  "ip": "192.168.1.1",
  "port": 8080,
  "user": "user1",
  "pass": "pass1",
  "message": "Proxy hiện tại (xoay sau 45s)",
  "timeRemaining": 45
}
```

**Lưu ý:**
- Format proxy: `ip:port:user:pass` (nếu có auth) hoặc `ip:port` (nếu không có auth)

**Giải thích:**
- `timeRemaining`: Số giây còn lại trước khi proxy tự động xoay (đếm ngược từ 60 về 0)
- `message`: Hiển thị thông báo kèm thời gian đếm ngược

**Test với cURL:**
```bash
# Thay YOUR_KEY bằng key bạn nhận được từ API mua key
curl http://localhost:3000/api/proxies/get/YOUR_KEY
```

**Test với Postman/Thunder Client:**
1. Method: GET
2. URL: `http://localhost:3000/api/proxies/get/YOUR_KEY`
3. Send request nhiều lần trong vòng 60s -> nhận được cùng 1 proxy
4. Đợi 60s rồi gửi lại -> nhận được proxy mới

---

### 3. **Xoay Proxy Ngay lập tức** (Public)

**Endpoint:** `GET /api/proxies/rotate/:key`

API này sẽ **bắt buộc xoay proxy mới** ngay lập tức, không cần đợi 60s.

**Response:**
```json
{
  "success": true,
  "key": "D8f3Y1MSh4lG7k_tFmwOkg",
  "proxy": "user2:pass2@192.168.1.2:8080",
  "host": "192.168.1.2",
  "port": 8080,
  "user": "user2",
  "pass": "pass2",
  "message": "Proxy đã được xoay thành công"
}
```

**Test với cURL:**
```bash
curl http://localhost:3000/api/proxies/rotate/YOUR_KEY
```

---

## Kịch bản Test Chi tiết

### Test Case 1: Mua key và lấy proxy

```bash
# Bước 1: Mua 3 key (không cần token)
curl -X POST http://localhost:3000/api/proxies/buy-key \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3, "time": 30}'

# Lưu lại một trong các key nhận được, ví dụ: ABC123XYZ

# Bước 2: Lấy proxy lần 1
curl http://localhost:3000/api/proxies/get/ABC123XYZ

# Bước 3: Lấy proxy lần 2 (trong vòng 60s) -> sẽ nhận proxy giống lần 1
curl http://localhost:3000/api/proxies/get/ABC123XYZ

# Bước 4: Đợi 60 giây...

# Bước 5: Lấy proxy lần 3 (sau 60s) -> sẽ nhận proxy mới
curl http://localhost:3000/api/proxies/get/ABC123XYZ
```

### Test Case 2: Xoay proxy thủ công

```bash
# Lấy proxy hiện tại
curl http://localhost:3000/api/proxies/get/ABC123XYZ

# Xoay proxy ngay lập tức (không cần đợi 60s)
curl http://localhost:3000/api/proxies/rotate/ABC123XYZ

# Lấy proxy lại -> sẽ thấy proxy mới
curl http://localhost:3000/api/proxies/get/ABC123XYZ
```

### Test Case 3: Proxy không bị trùng

```bash
# Gọi API rotate nhiều lần liên tiếp
curl http://localhost:3000/api/proxies/rotate/ABC123XYZ
curl http://localhost:3000/api/proxies/rotate/ABC123XYZ
curl http://localhost:3000/api/proxies/rotate/ABC123XYZ
curl http://localhost:3000/api/proxies/rotate/ABC123XYZ

# Mỗi lần sẽ nhận được proxy khác nhau
# Proxy gần đây sẽ không được chọn lại (theo RECENT_LIMIT = 5)
```

### Test Case 4: Key hết hạn

```bash
# Tạo key hết hạn sau 1 ngày
curl -X POST http://localhost:3000/api/proxies/buy-key \
  -H "Content-Type: application/json" \
  -d '{"time": 1}'

# Lấy key, ví dụ: EXPIRED_KEY

# Thử lấy proxy
curl http://localhost:3000/api/proxies/get/EXPIRED_KEY
# -> Sẽ hoạt động bình thường

# Sau 1 ngày, thử lại:
curl http://localhost:3000/api/proxies/get/EXPIRED_KEY
# -> Sẽ nhận được lỗi "Key đã hết hạn"
```

### Test Case 5: Key không tồn tại

```bash
curl http://localhost:3000/api/proxies/get/INVALID_KEY_12345
# Response:
# {
#   "success": false,
#   "message": "Key không tồn tại hoặc đã bị vô hiệu hóa",
#   "error": "NotFoundException"
# }
```

---

## Kiểm tra dữ liệu trong Redis

```bash
# Kết nối Redis CLI
redis-cli

# Kiểm tra proxy hiện tại của key
GET proxy:current:YOUR_KEY

# Kiểm tra thời gian rotate cuối
GET proxy:lastrotate:YOUR_KEY

# Kiểm tra danh sách proxy gần đây
LRANGE proxy:recent:YOUR_KEY 0 -1

# Kiểm tra proxy đang được sử dụng
SMEMBERS proxy:inuse
```

---

## Kiểm tra dữ liệu trong MongoDB

```javascript
// Kiểm tra các key đã tạo
db.proxy_keys.find().pretty();

// Kiểm tra key cụ thể
db.proxy_keys.findOne({ key: "YOUR_KEY" });

// Kiểm tra các proxy
db.proxies.find().pretty();
```

---

## Script Test Tự động (Node.js)

Tạo file `test-proxy-rotation.js`:

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/proxies';
const YOUR_KEY = 'YOUR_KEY_HERE'; // Thay bằng key thật

async function testProxyRotation() {
  console.log('=== Test 1: Lấy proxy lần 1 ===');
  const res1 = await axios.get(`${BASE_URL}/get/${YOUR_KEY}`);
  console.log(res1.data);

  console.log('\n=== Test 2: Lấy proxy lần 2 (trong 60s) ===');
  const res2 = await axios.get(`${BASE_URL}/get/${YOUR_KEY}`);
  console.log(res2.data);
  console.log('Reused:', res2.data.reused); // Phải là true

  console.log('\n=== Test 3: Xoay proxy thủ công ===');
  const res3 = await axios.get(`${BASE_URL}/rotate/${YOUR_KEY}`);
  console.log(res3.data);

  console.log('\n=== Test 4: Lấy proxy sau khi xoay ===');
  const res4 = await axios.get(`${BASE_URL}/get/${YOUR_KEY}`);
  console.log(res4.data);
  console.log('Reused:', res4.data.reused); // Phải là true (vì mới xoay)

  console.log('\n=== Test 5: Đợi 60s và lấy lại ===');
  await new Promise(resolve => setTimeout(resolve, 61000));
  const res5 = await axios.get(`${BASE_URL}/get/${YOUR_KEY}`);
  console.log(res5.data);
  console.log('Reused:', res5.data.reused); // Phải là false (đã hết thời gian)
}

testProxyRotation().catch(console.error);
```

Chạy:
```bash
node test-proxy-rotation.js
```

---

## Checklist Kiểm tra

- [ ] Mua key thành công với API `/buy-key`
- [ ] Lấy proxy lần đầu trả về proxy mới (`reused: false`)
- [ ] Lấy proxy lần 2 trong 60s trả về cùng proxy (`reused: true`)
- [ ] Sau 60s, proxy tự động xoay sang proxy mới
- [ ] API `/rotate/:key` xoay proxy ngay lập tức
- [ ] Mỗi lần xoay không bị trùng proxy (trong vòng 5 proxy gần nhất)
- [ ] Key hết hạn không thể lấy proxy
- [ ] Key không tồn tại trả về lỗi phù hợp
- [ ] Proxy được lưu vào Redis cache đúng
- [ ] Dữ liệu trong MongoDB chính xác

---

## Troubleshooting

### Lỗi "Key không tồn tại"
- Kiểm tra key có đúng không
- Kiểm tra trong MongoDB: `db.proxy_keys.find()`

### Lỗi "Không còn proxy khả dụng"
- Kiểm tra có proxy trong DB không: `db.proxies.find()`
- Thêm nhiều proxy hơn vào database

### Lỗi Connection refused
- Kiểm tra server có chạy không
- Kiểm tra Redis có chạy không
- Kiểm tra MongoDB có chạy không

### Proxy không xoay sau 60s
- Kiểm tra Redis key `proxy:lastrotate:YOUR_KEY`
- Kiểm tra thời gian server có chính xác không
