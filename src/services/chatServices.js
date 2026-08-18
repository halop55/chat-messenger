import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

const DEFAULT_CHAT_THEME_ID = "sky";

export const createPrivateChat = async (uid1, uid2) => {
  const sorted = [uid1, uid2].sort();
  const chatId = `${sorted[0]}_${sorted[1]}`;

  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      members: sorted,
      lastMessage: "",
      lastMessageId: "",
      lastSeenMessageIds: {},
      lastSeenAt: {},
      themeId: DEFAULT_CHAT_THEME_ID,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  return chatId;
};

const buildReplyPayload = (replyTo) =>
  replyTo?.id
    ? {
        id: replyTo.id,
        text: replyTo.text || "",
        senderName: replyTo.senderName || "",
      }
    : null;

export const sendTextMessage = async (
  chatId,
  senderId,
  text,
  senderName = "",
  replyTo = null
) => {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const replyPayload = buildReplyPayload(replyTo);

  const messageRef = await addDoc(messagesRef, {
    type: "text",
    text,
    senderId,
    senderName,
    ...(replyPayload ? { replyTo: replyPayload } : {}),
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    lastMessageId: messageRef.id,
    lastMessageAt: serverTimestamp(),
  });

  return messageRef.id;
};

export const sendImageMessage = async (
  chatId,
  senderId,
  imagePayload,
  senderName = "",
  replyTo = null
) => {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const replyPayload = buildReplyPayload(replyTo);

  const messageRef = await addDoc(messagesRef, {
    type: "image",
    text: "",
    imageData: imagePayload.dataUri,
    imageWidth: imagePayload.width || 0,
    imageHeight: imagePayload.height || 0,
    reactions: {},
    senderId,
    senderName,
    ...(replyPayload ? { replyTo: replyPayload } : {}),
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: "[Hinh anh]",
    lastMessageId: messageRef.id,
    lastMessageAt: serverTimestamp(),
  });

  return messageRef.id;
};

export const updateImageMessageReaction = async (
  chatId,
  messageId,
  userId,
  reaction
) => {
  const messageRef = doc(db, "chats", chatId, "messages", messageId);

  await updateDoc(messageRef, {
    [`reactions.${userId}`]: reaction || deleteField(),
    reactionUpdatedAt: serverTimestamp(),
  });
};

export const subscribeMessages = (chatId, callback) => {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
};

export const subscribeChat = (chatId, callback) =>
  onSnapshot(doc(db, "chats", chatId), (snapshot) => {
    callback(
      snapshot.exists()
        ? {
            id: snapshot.id,
            ...snapshot.data(),
          }
        : null
    );
  });

export const updateChatTheme = async (chatId, themeId) => {
  await updateDoc(doc(db, "chats", chatId), {
    themeId,
    updatedAt: serverTimestamp(),
  });
};

export const markChatSeen = async (chatId, userId, messageId) => {
  if (!chatId || !userId || !messageId) {
    return;
  }

  await updateDoc(doc(db, "chats", chatId), {
    [`lastSeenMessageIds.${userId}`]: messageId,
    [`lastSeenAt.${userId}`]: serverTimestamp(),
  });
};

export const deleteMessageForUser = async (chatId, messageId, userId) => {
  if (!chatId || !messageId || !userId) {
    return;
  }

  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    [`deletedFor.${userId}`]: true,
    updatedAt: serverTimestamp(),
  });
};

export const recallMessageForEveryone = async (
  chatId,
  messageId,
  currentUserId
) => {
  if (!chatId || !messageId || !currentUserId) {
    return;
  }

  const messageRef = doc(db, "chats", chatId, "messages", messageId);
  const messageSnapshot = await getDoc(messageRef);

  if (!messageSnapshot.exists()) {
    return;
  }

  const messageData = messageSnapshot.data();
  if (messageData.senderId !== currentUserId) {
    throw new Error("ONLY_SENDER_CAN_RECALL");
  }

  await updateDoc(messageRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: currentUserId,
    text: "",
    imageData: deleteField(),
    imageWidth: deleteField(),
    imageHeight: deleteField(),
    reactions: deleteField(),
    replyTo: deleteField(),
    updatedAt: serverTimestamp(),
  });

  const chatRef = doc(db, "chats", chatId);
  const chatSnapshot = await getDoc(chatRef);

  if (chatSnapshot.data()?.lastMessageId === messageId) {
    await updateDoc(chatRef, {
      lastMessage: "Tin nhan da bi thu hoi",
      lastMessageAt: serverTimestamp(),
    });
  }
};
