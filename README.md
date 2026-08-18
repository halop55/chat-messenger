~~# 💬 Chat Messenger App

## 🚀 Overview
Ứng dụng chat realtime giống Messenger, được xây dựng bằng React Native (Expo) và Firebase.

---

## ✨ Features
- 🔐 Đăng ký / đăng nhập (Firebase Authentication)
- 👥 Danh sách người dùng
- 💬 Chat realtime (Firestore)
- 🧑 Avatar tự động theo tên
- 🚪 Logout

---

## 🛠 Tech Stack
- React Native (Expo)
- Expo Router
- Firebase Authentication
- Firestore Database

---

## 🔄 App Flow
1. Mở app → Trang chính
2. Đăng nhập / đăng ký
3. Vào danh sách người dùng
4. Chọn người dùng
5. Mở màn hình chat
6. Gửi tin nhắn realtime

---

## 📁 Project Structure
app/
_layout.js
index.js
login.js
register.js
users.js
chat.js

src/
config/firebase.js
services/authServices.js
services/chatServices.js
utils/chatUi.js


---

## 🔥 Firebase Setup
1. Tạo project trên Firebase
2. Bật Authentication (Email/Password)
3. Bật Firestore Database
4. Copy config vào file:


---

## ▶️ How to Run
```bash
npm install
npx expo start

---

🔥 🔥 🔥 Cách dùng file PROJECT_CONTEXT.md (quan trọng)🔥 🔥 🔥 

Sau khi có file này:

Cách prompt như sau:

```text
Đọc file PROJECT_CONTEXT.md trước.

Sau đó sửa lỗi login không chuyển sang users.

Trả về code full file.