# PROJECT_CONTEXT.md

## Project Name
Chat Messenger App (React Native Expo + Firebase)

---

## Overview
Đây là ứng dụng chat realtime giống Messenger, được xây dựng bằng React Native (Expo) và Firebase.

App hỗ trợ:
- Đăng ký / đăng nhập
- Danh sách người dùng
- Chat realtime
- Avatar tùy chỉnh (upload từ thiết bị)
- Lưu ảnh avatar trên Firebase Storage

---

## Tech Stack
- React Native (Expo)
- Expo Router (file-based routing)
- Firebase Authentication
- Firebase Firestore
- Firebase Storage
- Expo Image Picker

---

## Project Structure
chat-messenger/

app/
_layout.js
index.js
login.js
register.js
users.js
chat.js

components/
UserAvatar.js
pickAvatarImage.js

src/
config/
firebase.js
services/
authServices.js
chatServices.js
utils/
chatUi.js


---

## Routing (Expo Router)

- `/` → index.js (Home)
- `/login` → login.js
- `/register` → register.js
- `/users` → users.js
- `/chat` → chat.js (params: otherUserId, otherUserName)

---

## Authentication Flow

1. User đăng ký:
    - createUserWithEmailAndPassword
    - upload avatar lên Firebase Storage
    - lưu user vào Firestore

2. User đăng nhập:
    - signInWithEmailAndPassword
    - redirect → /users

3. Logout:
    - signOut
    - redirect → /login

---

## Firestore Structure

### users collection
users/{uid}

uid
name
email
photoURL
createdAt


### chats collection
chats/{chatId}

members [uid1, uid2]
lastMessage
lastMessageAt
createdAt


### messages subcollection

chats/{chatId}/messages/{messageId}

text
senderId
createdAt


---

## Avatar System

- User chọn ảnh từ thiết bị (expo-image-picker)
- Ảnh được upload lên Firebase Storage:
  `avatars/{uid}.jpg`
- Lấy downloadURL
- Lưu vào:
    - Firebase Auth (photoURL)
    - Firestore (users collection)

---

## Chat Flow

1. User chọn người trong users list
2. App tạo chatId:
   `uid1_uid2` (sorted)
3. Nếu chưa có → tạo document
4. Subscribe realtime bằng `onSnapshot`
5. Gửi tin nhắn → addDoc vào messages

---

## Key Services

### authServices.js
- registerUser
- loginUser
- logoutUser
- updateCurrentUserAvatar

### chatServices.js
- createPrivateChat
- sendTextMessage
- subscribeMessages

---

## UI Utilities

### chatUi.js
- getInitials
- getAvatarColor
- formatMessageTime
- getConversationPreview
- getStatusLabel

---

## Important Rules (FOR AI)

1. Không thay đổi cấu trúc folder nếu không cần thiết
2. Không đổi tên route của Expo Router
3. Không thay đổi schema Firestore
4. Luôn kiểm tra:
    - auth.currentUser
    - otherUserId
    - chatId tồn tại
5. Không gửi message rỗng
6. Avatar phải fallback nếu không có photoURL

---

## Common Errors To Avoid

- Sai import path (../src/...)
- Thiếu component (UserAvatar, pickAvatarImage)
- Firebase chưa init
- Không check null auth.currentUser
- FlatList thiếu keyExtractor
- Không cleanup onSnapshot

---

## Run Project

```bash
npm install
npx expo start


