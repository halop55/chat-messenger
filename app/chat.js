import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "../components/UserAvatar";
import { pickChatImage } from "../components/pickChatImage";
import { auth, db } from "../src/config/firebase";
import {
  createPrivateChat,
  deleteMessageForUser,
  markChatSeen,
  recallMessageForEveryone,
  sendImageMessage,
  sendTextMessage,
  subscribeChat,
  subscribeMessages,
  updateImageMessageReaction,
  updateChatTheme,
} from "../src/services/chatServices";
import { getVoiceCallAvailability } from "../src/services/agoraVoiceService";
import { useVoiceCall } from "../VoiceCallProviderOptimized";
import {
  formatMessageTime,
  getStatusLabel,
  isUserOnline,
} from "../src/utils/chatUi";

const CHAT_THEMES = [
  {
    id: "sky",
    name: "Sky",
    canvas: "#F3F7FF",
    surface: "#FFFFFF",
    accent: "#1677FF",
    accentSoft: "#E7F0FF",
    orbPrimary: "#BFDBFE",
    orbSecondary: "#DBEAFE",
  },
  {
    id: "peach",
    name: "Sunset",
    canvas: "#FFF5F1",
    surface: "#FFFFFF",
    accent: "#F97316",
    accentSoft: "#FFE8D9",
    orbPrimary: "#FED7AA",
    orbSecondary: "#FDBA74",
  },
  {
    id: "mint",
    name: "Mint",
    canvas: "#F2FBF7",
    surface: "#FFFFFF",
    accent: "#0F9F6E",
    accentSoft: "#DDF7EC",
    orbPrimary: "#A7F3D0",
    orbSecondary: "#6EE7B7",
  },
  {
    id: "berry",
    name: "Berry",
    canvas: "#F9F5FF",
    surface: "#FFFFFF",
    accent: "#C026D3",
    accentSoft: "#F4E8FF",
    orbPrimary: "#E9D5FF",
    orbSecondary: "#D8B4FE",
  },
];

const QUICK_EMOJIS = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F60D}",
  "\u{1F973}",
  "\u{1F525}",
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F389}",
];

const IMAGE_REACTIONS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F44E}"];
const STYLE_BANNER_STORAGE_KEY = "chat_style_banner_hidden";
const getVoiceNoticeStorageKey = (noticeCode = "default") =>
  `chat_voice_notice_hidden_${noticeCode}`;
const PREVIEW_MAX_SCALE = 2.6;
const PREVIEW_MIN_SCALE = 1;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const getReactionMap = (message) => {
  if (!message?.reactions || typeof message.reactions !== "object") {
    return {};
  }

  return message.reactions;
};

const getReactionTotals = (message) => {
  const totals = IMAGE_REACTIONS.reduce((result, reaction) => {
    result[reaction] = 0;
    return result;
  }, {});

  Object.values(getReactionMap(message)).forEach((reaction) => {
    if (totals[reaction] !== undefined) {
      totals[reaction] += 1;
    }
  });

  return totals;
};

const getPreviewImageSize = (message, scale = 1) => {
  const width = Number(message?.imageWidth) || 1;
  const height = Number(message?.imageHeight) || 1;
  const ratio = width / height;
  const maxWidth = SCREEN_WIDTH - 32;
  const maxHeight = SCREEN_HEIGHT * 0.68;

  let previewWidth = maxWidth;
  let previewHeight = previewWidth / ratio;

  if (previewHeight > maxHeight) {
    previewHeight = maxHeight;
    previewWidth = previewHeight * ratio;
  }

  return {
    width: previewWidth * scale,
    height: previewHeight * scale,
  };
};

const getImageSize = (message) => {
  const width = Number(message?.imageWidth) || 1;
  const height = Number(message?.imageHeight) || 1;
  const ratio = width / height;

  if (ratio >= 1) {
    return {
      width: 220,
      aspectRatio: ratio,
    };
  }

  return {
    width: Math.max(140, 220 * ratio),
    aspectRatio: ratio,
  };
};

const getMessagePreviewText = (message) => {
  if (!message || message.deleted) {
    return "Tin nhan da bi thu hoi";
  }

  if (message.type === "image") {
    return "[Hinh anh]";
  }

  return message.text || "";
};

const getVoiceCallNotice = (availability) => {
  if (availability.code === "AGORA_EXPO_GO_UNSUPPORTED") {
    return {
      title: "Expo Go chi de chat",
      text: "App van mo va nhan tin duoc trong Expo Go. Muon goi thoai bang Agora, hay chay npm run android:run de cai ban Android native.",
      backgroundColor: "#FEF3C7",
      iconColor: "#B45309",
      textColor: "#92400E",
    };
  }

  if (availability.code === "AGORA_APP_ID_MISSING") {
    return {
      title: "Chua cau hinh Agora",
      text: "Them EXPO_PUBLIC_AGORA_APP_ID vao file .env truoc khi thu goi thoai.",
      backgroundColor: "#FEE2E2",
      iconColor: "#B91C1C",
      textColor: "#991B1B",
    };
  }

  return {
    title: "Khong ho tro goi thoai",
    text: availability.message || "Tinh nang goi thoai hien chua san sang.",
    backgroundColor: "#E5E7EB",
    iconColor: "#374151",
    textColor: "#1F2937",
  };
};

export default function ChatScreen() {
  const { otherUserId, otherUserName } = useLocalSearchParams();
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [replyMessage, setReplyMessage] = useState(null);
  const [showTools, setShowTools] = useState(false);
  const [chatThemeId, setChatThemeId] = useState(CHAT_THEMES[0].id);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [reactionLoadingId, setReactionLoadingId] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [previewScale, setPreviewScale] = useState(PREVIEW_MIN_SCALE);
  const [showStyleBanner, setShowStyleBanner] = useState(true);
  const [showVoiceNoticeBanner, setShowVoiceNoticeBanner] = useState(true);
  const [presenceNow, setPresenceNow] = useState(Date.now());
  const listRef = useRef(null);
  const lastMarkedSeenMessageIdRef = useRef("");
  const { activeCall, busy, startCall, endCurrentCall } = useVoiceCall();
  const currentUserId = auth.currentUser?.uid || "";
  const currentUserName =
    auth.currentUser?.displayName || auth.currentUser?.email || "Ban";
  const displayName =
    otherUser?.name ||
    (otherUserName ? decodeURIComponent(otherUserName) : "Chat");
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => !message?.deletedFor?.[currentUserId]
      ),
    [currentUserId, messages]
  );
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages]
  );
  const latestOwnVisibleMessage = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message.senderId === currentUserId && !message.deleted) {
        return message;
      }
    }

    return null;
  }, [currentUserId, visibleMessages]);
  const otherUserLastSeenMessageId =
    chatData?.lastSeenMessageIds?.[otherUserId] || "";
  const latestOwnMessageIndex = latestOwnVisibleMessage
    ? messages.findIndex((message) => message.id === latestOwnVisibleMessage.id)
    : -1;
  const otherUserLastSeenIndex = otherUserLastSeenMessageId
    ? messages.findIndex((message) => message.id === otherUserLastSeenMessageId)
    : -1;
  const latestOwnMessageSeen =
    latestOwnMessageIndex >= 0 &&
    otherUserLastSeenIndex >= latestOwnMessageIndex;
  const activeTheme =
    CHAT_THEMES.find((theme) => theme.id === chatThemeId) || CHAT_THEMES[0];
  const isCurrentChatCall = activeCall?.chatId === chatId;
  const voiceCallAvailability = getVoiceCallAvailability();
  const voiceCallNotice = !voiceCallAvailability.supported
    ? getVoiceCallNotice(voiceCallAvailability)
    : null;
  const callButtonDisabled = !isCurrentChatCall && busy;
  const callButtonColor = isCurrentChatCall
    ? "#EF4444"
    : voiceCallAvailability.supported
      ? activeTheme.accent
      : voiceCallNotice?.iconColor || "#64748B";
  const callButtonBackground = isCurrentChatCall
    ? "#FEE2E2"
    : voiceCallAvailability.supported
      ? activeTheme.accentSoft
      : "#F8FAFC";

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STYLE_BANNER_STORAGE_KEY)
      .then((value) => {
        if (isMounted && value === "1") {
          setShowStyleBanner(false);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (voiceCallAvailability.supported) {
      return undefined;
    }

    let isMounted = true;
    setShowVoiceNoticeBanner(true);

    AsyncStorage.getItem(getVoiceNoticeStorageKey(voiceCallAvailability.code))
      .then((value) => {
        if (isMounted && value === "1") {
          setShowVoiceNoticeBanner(false);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [voiceCallAvailability.code, voiceCallAvailability.supported]);

  useEffect(() => {
    if (!otherUserId) {
      return undefined;
    }

    return onSnapshot(
      doc(db, "users", otherUserId),
      (snapshot) => {
        setOtherUser(snapshot.exists() ? snapshot.data() : null);
      },
      (error) => {
        console.log("LOAD OTHER USER ERROR:", error);
      }
    );
  }, [otherUserId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setPresenceNow(Date.now());
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let unsubscribeMessages;
    let unsubscribeChat;

    const setupChat = async () => {
      try {
        if (!auth.currentUser?.uid || !otherUserId) {
          return;
        }

        const id = await createPrivateChat(auth.currentUser.uid, otherUserId);
        setChatId(id);

        unsubscribeChat = subscribeChat(id, (chatData) => {
          setChatData(chatData);
          setChatThemeId(chatData?.themeId || CHAT_THEMES[0].id);
        });

        unsubscribeMessages = subscribeMessages(id, (data) => {
          setMessages(data);
          setTimeout(() => {
            listRef.current?.scrollToEnd?.({ animated: true });
          }, 100);
        });
      } catch (error) {
        console.log("SETUP CHAT ERROR:", error);
        Alert.alert("Loi", "Khong tao duoc cuoc tro chuyen");
      }
    };

    setupChat();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeChat) unsubscribeChat();
    };
  }, [otherUserId]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];

    if (!chatId || !currentUserId || !latestMessage?.id) {
      return;
    }

    if (lastMarkedSeenMessageIdRef.current === latestMessage.id) {
      return;
    }

    lastMarkedSeenMessageIdRef.current = latestMessage.id;
    markChatSeen(chatId, currentUserId, latestMessage.id).catch((error) => {
      console.log("MARK CHAT SEEN ERROR:", error);
      lastMarkedSeenMessageIdRef.current = "";
    });
  }, [chatId, currentUserId, messages]);

  const handleInsertEmoji = (emoji) => {
    setText((currentText) => `${currentText}${emoji}`);
  };

  const handleThemeChange = async (themeId) => {
    if (!chatId) return;

    try {
      setChatThemeId(themeId);
      await updateChatTheme(chatId, themeId);
    } catch (error) {
      console.log("UPDATE THEME ERROR:", error);
      Alert.alert("Loi", "Khong doi duoc giao dien cuoc tro chuyen");
    }
  };

  const handleSend = async () => {
    try {
      if (!text.trim()) return;
      if (!chatId) {
        Alert.alert("Loi", "Chua tao duoc phong chat");
        return;
      }
      if (!auth.currentUser?.uid) {
        Alert.alert("Loi", "Ban chua dang nhap");
        return;
      }

      await sendTextMessage(
        chatId,
        auth.currentUser.uid,
        text.trim(),
        currentUserName,
        replyMessage
          ? {
              id: replyMessage.id,
              text: getMessagePreviewText(replyMessage),
              senderName: replyMessage.senderName,
            }
          : null
      );
      setText("");
      setReplyMessage(null);

      setTimeout(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      }, 100);
    } catch (error) {
      console.log("SEND ERROR:", error);
      Alert.alert("Loi gui tin nhan", error.message || "Khong ro loi");
    }
  };

  const handleSendImage = async () => {
    try {
      if (!chatId) {
        Alert.alert("Loi", "Chua tao duoc phong chat");
        return;
      }

      if (!auth.currentUser?.uid) {
        Alert.alert("Loi", "Ban chua dang nhap");
        return;
      }

      setIsSendingImage(true);
      const selectedImage = await pickChatImage();

      if (!selectedImage?.dataUri) {
        return;
      }

      await sendImageMessage(
        chatId,
        auth.currentUser.uid,
        selectedImage,
        currentUserName,
        replyMessage
          ? {
              id: replyMessage.id,
              text: getMessagePreviewText(replyMessage),
              senderName: replyMessage.senderName,
            }
          : null
      );
      setReplyMessage(null);

      setTimeout(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      }, 100);
    } catch (error) {
      console.log("SEND IMAGE ERROR:", error);
      Alert.alert("Loi gui anh", error?.message || "Khong ro loi");
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleDismissStyleBanner = () => {
    setShowStyleBanner(false);
    AsyncStorage.setItem(STYLE_BANNER_STORAGE_KEY, "1").catch(() => {});
  };

  const handleDismissVoiceNotice = () => {
    setShowVoiceNoticeBanner(false);
    AsyncStorage.setItem(
      getVoiceNoticeStorageKey(voiceCallAvailability.code),
      "1"
    ).catch(() => {});
  };

  const openImagePreview = (message) => {
    setPreviewImage(message);
    setPreviewScale(PREVIEW_MIN_SCALE);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
    setPreviewScale(PREVIEW_MIN_SCALE);
  };

  const handlePreviewScaleChange = (direction) => {
    setPreviewScale((currentScale) => {
      const nextScale =
        direction === "in" ? currentScale + 0.4 : currentScale - 0.4;

      return Math.max(PREVIEW_MIN_SCALE, Math.min(PREVIEW_MAX_SCALE, nextScale));
    });
  };

  const handlePreviewImagePress = () => {
    setPreviewScale((currentScale) =>
      currentScale >= PREVIEW_MAX_SCALE ? PREVIEW_MIN_SCALE : currentScale + 0.6
    );
  };

  const handleImageReactionPress = async (message, reaction) => {
    try {
      if (!chatId || !message?.id) {
        return;
      }

      if (!auth.currentUser?.uid) {
        Alert.alert("Loi", "Ban chua dang nhap");
        return;
      }

      const currentReaction = getReactionMap(message)[auth.currentUser.uid] || "";
      const nextReaction = currentReaction === reaction ? "" : reaction;

      setReactionLoadingId(message.id);
      await updateImageMessageReaction(
        chatId,
        message.id,
        auth.currentUser.uid,
        nextReaction
      );
    } catch (error) {
      console.log("REACTION ERROR:", error);
      Alert.alert("Khong the tha cam xuc", error?.message || "Khong ro loi");
    } finally {
      setReactionLoadingId("");
    }
  };

  const buildReplyMessage = (message) => ({
    ...message,
    senderName:
      message.senderName ||
      (message.senderId === currentUserId ? currentUserName : displayName),
  });

  const handleDeleteForMe = async (message) => {
    try {
      if (!chatId || !currentUserId || !message?.id) {
        return;
      }

      await deleteMessageForUser(chatId, message.id, currentUserId);
    } catch (error) {
      console.log("DELETE FOR ME ERROR:", error);
      Alert.alert("Khong the xoa tin nhan", error?.message || "Khong ro loi");
    }
  };

  const handleRecallForEveryone = async (message) => {
    try {
      if (!chatId || !currentUserId || !message?.id) {
        return;
      }

      await recallMessageForEveryone(chatId, message.id, currentUserId);
    } catch (error) {
      console.log("RECALL MESSAGE ERROR:", error);
      Alert.alert(
        "Khong the thu hoi tin nhan",
        error?.message || "Khong ro loi"
      );
    }
  };

  const handleMessageLongPress = (message) => {
    const isMine = message.senderId === currentUserId;
    const actions = [];

    if (!message.deleted) {
      actions.push({
        text: "Tra loi",
        onPress: () => setReplyMessage(buildReplyMessage(message)),
      });
    }

    actions.push({
        text: "Xoa phia toi",
        onPress: () => handleDeleteForMe(message),
      });

    if (isMine && !message.deleted) {
      actions.push({
        text: "Thu hoi cho moi nguoi",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Thu hoi tin nhan",
            "Tin nhan se hien la da bi thu hoi voi moi nguoi.",
            [
              { text: "Huy", style: "cancel" },
              {
                text: "Thu hoi",
                style: "destructive",
                onPress: () => handleRecallForEveryone(message),
              },
            ]
          ),
      });
    }

    actions.push({ text: "Huy", style: "cancel" });
    Alert.alert("Tin nhan", "", actions);
  };

  const handleVoiceCallPress = async () => {
    if (isCurrentChatCall) {
      await endCurrentCall();
      return;
    }

    if (!voiceCallAvailability.supported) {
      Alert.alert(
        voiceCallNotice?.title || "Khong the goi thoai",
        voiceCallNotice?.text || voiceCallAvailability.message
      );
      return;
    }

    if (!chatId || !otherUserId) {
      Alert.alert("Loi", "Chua san sang thong tin cuoc tro chuyen de goi.");
      return;
    }

    await startCall({
      chatId,
      otherUserId,
      otherUserName: displayName,
    });
  };

  const renderItem = ({ item, index }) => {
    const isMine = item.senderId === auth.currentUser?.uid;
    const previousMessage = visibleMessages[index - 1];
    const showAvatar = !isMine && previousMessage?.senderId !== item.senderId;
    const isImageMessage = !item.deleted && item.type === "image" && item.imageData;
    const imageSize = isImageMessage ? getImageSize(item) : null;
    const reactionTotals = isImageMessage ? getReactionTotals(item) : null;
    const currentReaction = isImageMessage
      ? getReactionMap(item)[auth.currentUser?.uid] || ""
      : "";
    const repliedMessage = item.replyTo?.id
      ? messagesById.get(item.replyTo.id)
      : null;
    const replyPreviewText = repliedMessage?.deleted
      ? "Tin nhan da bi thu hoi"
      : item.replyTo?.text || "";
    const showSeen =
      latestOwnVisibleMessage?.id === item.id && latestOwnMessageSeen;

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        {!isMine ? (
          showAvatar ? (
            <UserAvatar
              name={displayName}
              email={otherUser?.email}
              seed={otherUserId}
              photoURL={otherUser?.photoURL}
              size={40}
            />
          ) : (
            <View style={styles.avatarSpacer} />
          )
        ) : null}

        <View style={[styles.messageGroup, isMine && styles.myMessageGroup]}>
          <TouchableOpacity
            style={[
              styles.messageBubble,
              isImageMessage && styles.imageBubble,
              isMine
                ? [styles.myMessage, { backgroundColor: activeTheme.accent }]
                : [styles.otherMessage, { backgroundColor: activeTheme.surface }],
            ]}
            activeOpacity={0.9}
            onLongPress={() => handleMessageLongPress(item)}
            delayLongPress={260}
          >
            {item.replyTo ? (
              <View
                style={[
                  styles.replySnippet,
                  isMine ? styles.myReplySnippet : styles.otherReplySnippet,
                ]}
              >
                <Text
                  style={[
                    styles.replySenderName,
                    isMine ? styles.myReplySenderName : styles.otherReplySenderName,
                  ]}
                  numberOfLines={1}
                >
                  {item.replyTo.senderName || "Tin nhan"}
                </Text>
                <Text
                  style={[
                    styles.replySnippetText,
                    isMine ? styles.myReplySnippetText : styles.otherReplySnippetText,
                  ]}
                  numberOfLines={1}
                >
                  {replyPreviewText}
                </Text>
              </View>
            ) : null}

            {item.deleted ? (
              <Text style={isMine ? styles.myDeletedText : styles.otherDeletedText}>
                Tin nhan da bi thu hoi
              </Text>
            ) : isImageMessage ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => openImagePreview(item)}
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={260}
              >
                <Image
                  source={{ uri: item.imageData }}
                  style={[styles.messageImage, imageSize]}
                  resizeMode="cover"
                />
                <View style={styles.imageZoomHint}>
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                  <Text style={styles.imageZoomHintText}>Xem anh</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={isMine ? styles.myText : styles.otherText}>
                {item.text}
              </Text>
            )}
          </TouchableOpacity>
          {isImageMessage ? (
            <View style={[styles.reactionRow, isMine && styles.reactionRowMine]}>
              {IMAGE_REACTIONS.map((reaction) => {
                const count = reactionTotals?.[reaction] || 0;
                const isActive = currentReaction === reaction;
                const isLoading = reactionLoadingId === item.id;

                return (
                  <TouchableOpacity
                    key={`${item.id}-${reaction}`}
                    style={[
                      styles.reactionChip,
                      isActive && [
                        styles.reactionChipActive,
                        { borderColor: activeTheme.accent },
                      ],
                    ]}
                    onPress={() => handleImageReactionPress(item, reaction)}
                    disabled={isLoading}
                  >
                    <Text style={styles.reactionEmoji}>{reaction}</Text>
                    {count > 0 ? (
                      <Text style={styles.reactionCount}>{count}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <Text style={[styles.timeLabel, isMine && styles.timeLabelMine]}>
            {formatMessageTime(item.createdAt)}
          </Text>
          {showSeen ? (
            <Text style={[styles.seenLabel, isMine && styles.seenLabelMine]}>
              Da xem
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: activeTheme.canvas }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={18}
      >
        <View style={[styles.header, { backgroundColor: "rgba(255,255,255,0.94)" }]}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerProfile}>
            <UserAvatar
              name={displayName}
              email={otherUser?.email}
              seed={otherUserId}
              photoURL={otherUser?.photoURL}
              size={40}
            />
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text
                style={[
                  styles.headerStatus,
                  !isUserOnline(otherUser, presenceNow) &&
                    styles.headerStatusOffline,
                ]}
              >
                {getStatusLabel(otherUser, presenceNow)}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: callButtonBackground,
                  opacity: callButtonDisabled ? 0.55 : 1,
                },
              ]}
              onPress={handleVoiceCallPress}
              disabled={callButtonDisabled}
            >
              <Ionicons
                name={isCurrentChatCall ? "call" : "call-outline"}
                size={20}
                color={callButtonColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: activeTheme.accentSoft }]}
              onPress={() => setShowTools((currentValue) => !currentValue)}
            >
              <Ionicons
                name="color-palette-outline"
                size={20}
                color={activeTheme.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        {showStyleBanner ? (
          <View style={[styles.banner, { backgroundColor: activeTheme.accentSoft }]}>
            <View style={styles.bannerHeaderRow}>
              <Text style={[styles.bannerTitle, { color: activeTheme.accent }]}>
                Messenger style
              </Text>
              <TouchableOpacity
                style={styles.bannerCloseButton}
                onPress={handleDismissStyleBanner}
              >
                <Ionicons name="close" size={16} color={activeTheme.accent} />
              </TouchableOpacity>
            </View>
            <Text style={styles.bannerText}>
              Doi nen chat theo tung cuoc tro chuyen va chen emoji nhanh ngay
              trong o nhan tin.
            </Text>
          </View>
        ) : null}

        {voiceCallNotice && showVoiceNoticeBanner ? (
          <View
            style={[
              styles.callNoticeBanner,
              { backgroundColor: voiceCallNotice.backgroundColor },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={voiceCallNotice.iconColor}
            />
            <View style={styles.callNoticeTextWrap}>
              <View style={styles.bannerHeaderRow}>
                <Text
                  style={[styles.callNoticeTitle, { color: voiceCallNotice.textColor }]}
                >
                  {voiceCallNotice.title}
                </Text>
                <TouchableOpacity
                  style={styles.bannerCloseButton}
                  onPress={handleDismissVoiceNotice}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={voiceCallNotice.textColor}
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={[styles.callNoticeText, { color: voiceCallNotice.textColor }]}
              >
                {voiceCallNotice.text}
              </Text>
            </View>
          </View>
        ) : null}

        {isCurrentChatCall ? (
          <View
            style={[
              styles.callStatusBanner,
              {
                backgroundColor:
                  activeCall?.status === "accepted" ? "#DCFCE7" : "#DBEAFE",
              },
            ]}
          >
            <Ionicons
              name={activeCall?.status === "accepted" ? "call" : "call-outline"}
              size={18}
              color={activeCall?.status === "accepted" ? "#15803D" : "#1D4ED8"}
            />
            <Text
              style={[
                styles.callStatusText,
                {
                  color:
                    activeCall?.status === "accepted" ? "#166534" : "#1E3A8A",
                },
              ]}
            >
              {activeCall?.status === "accepted"
                ? activeCall.joined
                  ? activeCall.remoteUsers.length > 0
                    ? "Cuoc goi dang dien ra, 2 may da noi micro."
                    : "Da vao phong voice, dang cho dau ben kia ket noi."
                  : "Dang khoi tao ket noi voice..."
                : activeCall?.direction === "incoming"
                  ? "Ban dang co cuoc goi den tu nguoi nay."
                  : "Ban dang goi nguoi nay."}
            </Text>
          </View>
        ) : null}

        <View style={[styles.chatCanvas, { backgroundColor: activeTheme.canvas }]}>
          <View
            style={[
              styles.backgroundOrb,
              styles.backgroundOrbTop,
              { backgroundColor: activeTheme.orbPrimary },
            ]}
          />
          <View
            style={[
              styles.backgroundOrb,
              styles.backgroundOrbBottom,
              { backgroundColor: activeTheme.orbSecondary },
            ]}
          />

          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <UserAvatar
                  name={displayName}
                  email={otherUser?.email}
                  seed={otherUserId}
                  photoURL={otherUser?.photoURL}
                  size={40}
                />
                <Text style={styles.emptyTitle}>{displayName}</Text>
                <Text style={styles.emptyText}>
                  Hay gui tin nhan hoac anh dau tien de bat dau cuoc tro chuyen.
                </Text>
              </View>
            }
          />
        </View>

        {showTools ? (
          <View style={[styles.toolsPanel, { backgroundColor: activeTheme.surface }]}>
            <Text style={styles.toolsTitle}>Emoji nhanh</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolsRow}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiChip, { backgroundColor: activeTheme.accentSoft }]}
                  onPress={() => handleInsertEmoji(emoji)}
                >
                  <Text style={styles.emojiChipText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.toolsTitle}>Nen cuoc tro chuyen</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolsRow}
            >
              {CHAT_THEMES.map((theme) => {
                const isActive = theme.id === activeTheme.id;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: theme.accentSoft,
                        borderColor: isActive ? theme.accent : "transparent",
                      },
                    ]}
                    onPress={() => handleThemeChange(theme.id)}
                  >
                    <View style={styles.themePreviewRow}>
                      <View
                        style={[
                          styles.themePreviewBubble,
                          { backgroundColor: theme.accent },
                        ]}
                      />
                      <View
                        style={[
                          styles.themePreviewBubble,
                          styles.themePreviewBubbleSoft,
                          { backgroundColor: theme.surface },
                        ]}
                      />
                    </View>
                    <Text style={[styles.themeName, { color: theme.accent }]}>
                      {theme.name}
                    </Text>
                    {isActive ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {replyMessage ? (
          <View style={[styles.replyComposer, { backgroundColor: activeTheme.surface }]}>
            <View
              style={[
                styles.replyComposerBar,
                { backgroundColor: activeTheme.accent },
              ]}
            />
            <View style={styles.replyComposerTextWrap}>
              <Text style={[styles.replyComposerTitle, { color: activeTheme.accent }]}>
                Dang tra loi {replyMessage.senderName}
              </Text>
              <Text style={styles.replyComposerText} numberOfLines={1}>
                {getMessagePreviewText(replyMessage)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replyComposerClose}
              onPress={() => setReplyMessage(null)}
            >
              <Ionicons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.inputBar, { backgroundColor: activeTheme.surface }]}>
          <TouchableOpacity
            style={[styles.plusButton, { backgroundColor: activeTheme.accentSoft }]}
            onPress={() => setShowTools((currentValue) => !currentValue)}
            disabled={isSendingImage}
          >
            <Ionicons
              name={showTools ? "close" : "add"}
              size={22}
              color={activeTheme.accent}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Nhan tin..."
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
          />

          <TouchableOpacity
            style={[styles.emojiButton, { backgroundColor: activeTheme.accentSoft }]}
            onPress={() => handleInsertEmoji("\u{1F600}")}
            disabled={isSendingImage}
          >
            <Ionicons name="happy-outline" size={20} color={activeTheme.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.emojiButton, { backgroundColor: activeTheme.accentSoft }]}
            onPress={handleSendImage}
            disabled={isSendingImage}
          >
            {isSendingImage ? (
              <ActivityIndicator size="small" color={activeTheme.accent} />
            ) : (
              <Ionicons name="image-outline" size={20} color={activeTheme.accent} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: activeTheme.accent }]}
            onPress={handleSend}
            disabled={isSendingImage}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={Boolean(previewImage)}
          onRequestClose={closeImagePreview}
        >
          <SafeAreaView style={styles.previewOverlay}>
            <View style={styles.previewHeader}>
              <TouchableOpacity
                style={styles.previewIconButton}
                onPress={closeImagePreview}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>

              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewIconButton}
                  onPress={() => handlePreviewScaleChange("out")}
                  disabled={previewScale <= PREVIEW_MIN_SCALE}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={previewScale <= PREVIEW_MIN_SCALE ? "#94A3B8" : "#fff"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.previewIconButton}
                  onPress={() => handlePreviewScaleChange("in")}
                  disabled={previewScale >= PREVIEW_MAX_SCALE}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={previewScale >= PREVIEW_MAX_SCALE ? "#94A3B8" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {previewImage ? (
              <TouchableOpacity
                activeOpacity={1}
                style={styles.previewBody}
                onPress={handlePreviewImagePress}
              >
                <Image
                  source={{ uri: previewImage.imageData }}
                  style={[
                    styles.previewImage,
                    getPreviewImageSize(previewImage, previewScale),
                  ]}
                  resizeMode="contain"
                />
                <Text style={styles.previewHint}>
                  Cham vao anh de phong to hoac thu nho
                </Text>
              </TouchableOpacity>
            ) : null}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F7FF",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  headerTextWrap: {
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  headerStatus: {
    marginTop: 2,
    fontSize: 13,
    color: "#22C55E",
    fontWeight: "700",
  },
  headerStatusOffline: {
    color: "#64748B",
  },
  banner: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 6,
    borderRadius: 22,
    backgroundColor: "#E7F0FF",
    padding: 16,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1677FF",
  },
  bannerCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
  },
  callStatusBanner: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  callNoticeBanner: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  callNoticeTextWrap: {
    flex: 1,
  },
  callNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  callNoticeText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  callStatusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  chatCanvas: {
    flex: 1,
    overflow: "hidden",
  },
  backgroundOrb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.42,
  },
  backgroundOrbTop: {
    width: 220,
    height: 220,
    top: -80,
    right: -70,
  },
  backgroundOrbBottom: {
    width: 200,
    height: 200,
    left: -50,
    bottom: 30,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 70,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 260,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  avatarSpacer: {
    width: 40,
  },
  messageGroup: {
    maxWidth: "78%",
    marginLeft: 8,
  },
  myMessageGroup: {
    marginLeft: 0,
    marginRight: 0,
    alignItems: "flex-end",
  },
  messageBubble: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 22,
  },
  imageBubble: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  myMessage: {
    backgroundColor: "#1677FF",
    borderBottomRightRadius: 8,
  },
  otherMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 8,
  },
  myText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  otherText: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  myDeletedText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "600",
  },
  otherDeletedText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "600",
  },
  replySnippet: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
  myReplySnippet: {
    borderLeftColor: "rgba(255,255,255,0.75)",
  },
  otherReplySnippet: {
    borderLeftColor: "#CBD5E1",
  },
  replySenderName: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  myReplySenderName: {
    color: "#fff",
  },
  otherReplySenderName: {
    color: "#1677FF",
  },
  replySnippetText: {
    fontSize: 12,
    fontWeight: "600",
  },
  myReplySnippetText: {
    color: "rgba(255,255,255,0.82)",
  },
  otherReplySnippetText: {
    color: "#475569",
  },
  messageImage: {
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    minHeight: 120,
  },
  imageZoomHint: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.55)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  imageZoomHintText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  reactionRowMine: {
    justifyContent: "flex-end",
  },
  reactionChip: {
    minWidth: 46,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reactionChipActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  timeLabel: {
    marginTop: 6,
    marginLeft: 6,
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
  },
  timeLabelMine: {
    marginRight: 6,
    marginLeft: 0,
  },
  seenLabel: {
    marginTop: 3,
    marginLeft: 6,
    fontSize: 11,
    color: "#1677FF",
    fontWeight: "800",
  },
  seenLabelMine: {
    marginRight: 6,
    marginLeft: 0,
  },
  toolsPanel: {
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  toolsTitle: {
    paddingHorizontal: 16,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  toolsRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  emojiChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChipText: {
    fontSize: 22,
  },
  themeCard: {
    width: 124,
    borderRadius: 20,
    padding: 14,
    borderWidth: 2,
  },
  themePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  themePreviewBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  themePreviewBubbleSoft: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  themeName: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  replyComposer: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  replyComposerBar: {
    width: 4,
    alignSelf: "stretch",
    marginVertical: 10,
    borderRadius: 999,
  },
  replyComposerTextWrap: {
    flex: 1,
  },
  replyComposerTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  replyComposerText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  replyComposerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  plusButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E7F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    paddingHorizontal: 18,
    color: "#111827",
    fontSize: 15,
  },
  emojiButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.94)",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  previewBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    borderRadius: 24,
    backgroundColor: "#0F172A",
  },
  previewHint: {
    marginTop: 18,
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
