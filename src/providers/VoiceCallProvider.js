import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../config/firebase";
import {
  addAgoraEventListeners,
  assertAgoraVoiceReady,
  getAgoraSetupHelp,
  joinVoiceChannel,
  leaveVoiceChannel,
  releaseVoiceEngine,
  setMicrophoneMuted,
  setSpeakerEnabled,
} from "../services/agoraVoiceService";
import {
  VOICE_CALL_STATUSES,
  acceptVoiceCall,
  declineVoiceCall,
  endVoiceCall,
  getVoiceCallPeer,
  isVoiceCallActiveStatus,
  isVoiceCallTerminalStatus,
  markVoiceCallMissed,
  startVoiceCall,
  subscribeUserVoiceCalls,
} from "../services/voiceCallServices";

const VoiceCallContext = createContext({
  activeCall: null,
  busy: false,
  startCall: async () => false,
  endCurrentCall: async () => {},
});

const DEFAULT_RUNTIME_STATE = {
  joined: false,
  isConnecting: false,
  isMuted: false,
  isSpeakerOn: true,
  remoteUsers: [],
  agoraError: "",
};

const getVoiceCallTerminalKey = (voiceCall) => {
  if (!voiceCall) {
    return "";
  }

  return `${voiceCall.chatId}:${voiceCall.status}:${
    voiceCall.updatedAtMs || voiceCall.endedAtMs || 0
  }`;
};

const getFriendlyCallError = (error) => {
  if (!error) {
    return "Khong ro loi khi bat dau cuoc goi.";
  }

  if (error.code === "AGORA_APP_ID_MISSING") {
    return `Chua cau hinh Agora. ${getAgoraSetupHelp()}`;
  }

  if (error.code === "AGORA_NATIVE_MODULE_UNAVAILABLE") {
    return `Ban can build native app truoc khi test goi thoai. ${getAgoraSetupHelp()}`;
  }

  if (error.code === "AGORA_WEB_UNSUPPORTED") {
    return "Tinh nang goi thoai hien chi ho tro Android va iOS.";
  }

  if (error.message === "MIC_PERMISSION_DENIED") {
    return "Ban can cap quyen micro de bat dau cuoc goi.";
  }

  return error.message || "Khong ro loi khi bat dau cuoc goi.";
};

const ensureMicrophonePermission = async () => {
  if (Platform.OS === "web") {
    throw new Error("MIC_PERMISSION_DENIED");
  }

  if (Platform.OS !== "android") {
    return true;
  }

  const permission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "Quyen micro",
      message: "Ung dung can micro de 2 may co the noi chuyen voi nhau.",
      buttonPositive: "Cho phep",
      buttonNegative: "Tu choi",
    }
  );

  if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("MIC_PERMISSION_DENIED");
  }

  return true;
};

const buildUiVoiceCall = (voiceCall, currentUserId, runtimeState) => {
  if (!voiceCall || isVoiceCallTerminalStatus(voiceCall.status)) {
    return null;
  }

  const peer = getVoiceCallPeer(voiceCall, currentUserId);
  const direction =
    currentUserId === voiceCall.calleeId ? "incoming" : "outgoing";

  return {
    ...voiceCall,
    direction,
    otherUserId: peer?.uid,
    otherUserName: peer?.name || "Nguoi dung",
    joined: runtimeState.joined,
    isConnecting: runtimeState.isConnecting,
    isMuted: runtimeState.isMuted,
    isSpeakerOn: runtimeState.isSpeakerOn,
    remoteUsers: runtimeState.remoteUsers,
    agoraError: runtimeState.agoraError,
  };
};

export function VoiceCallProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(auth.currentUser?.uid || "");
  const [voiceCallDoc, setVoiceCallDoc] = useState(null);
  const [runtimeState, setRuntimeState] = useState(DEFAULT_RUNTIME_STATE);
  const voiceCallRef = useRef(null);
  const currentUserIdRef = useRef(currentUserId);
  const listenersCleanupRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const joinedChannelRef = useRef("");
  const handledTerminalCallRef = useRef("");

  currentUserIdRef.current = currentUserId;
  voiceCallRef.current = voiceCallDoc;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || "");

      if (!user) {
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }

        if (listenersCleanupRef.current) {
          listenersCleanupRef.current();
          listenersCleanupRef.current = null;
        }

        try {
          leaveVoiceChannel();
        } catch (_error) {
          // no-op
        }

        releaseVoiceEngine();
        joinedChannelRef.current = "";
        setVoiceCallDoc(null);
        setRuntimeState(DEFAULT_RUNTIME_STATE);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const unsubscribe = subscribeUserVoiceCalls(currentUserId, (voiceCalls) => {
      const availableCalls = [...voiceCalls]
        .filter((voiceCall) => {
          if (!isVoiceCallTerminalStatus(voiceCall.status)) {
            return true;
          }

          return getVoiceCallTerminalKey(voiceCall) !== handledTerminalCallRef.current;
        })
        .sort(
          (left, right) =>
            (right.updatedAtMs || right.createdAtMs || 0) -
            (left.updatedAtMs || left.createdAtMs || 0)
        );

      const currentChatId = voiceCallRef.current?.chatId;
      const currentChatCall = currentChatId
        ? availableCalls.find((voiceCall) => voiceCall.chatId === currentChatId)
        : null;
      const nextActiveCall = availableCalls.find((voiceCall) =>
        isVoiceCallActiveStatus(voiceCall.status)
      );

      setVoiceCallDoc(currentChatCall || nextActiveCall || null);
    });

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!voiceCallDoc) {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }

      if (listenersCleanupRef.current) {
        listenersCleanupRef.current();
        listenersCleanupRef.current = null;
      }

      try {
        leaveVoiceChannel();
      } catch (_error) {
        // no-op
      }

      releaseVoiceEngine();
      joinedChannelRef.current = "";
      setRuntimeState(DEFAULT_RUNTIME_STATE);
    }
  }, [voiceCallDoc]);

  useEffect(() => {
    if (!voiceCallDoc || voiceCallDoc.status !== VOICE_CALL_STATUSES.RINGING) {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }

      return undefined;
    }

    if (currentUserId !== voiceCallDoc.callerId) {
      return undefined;
    }

    const msRemaining = (voiceCallDoc.ringTimeoutAt || 0) - Date.now();

    if (msRemaining <= 0) {
      markVoiceCallMissed(voiceCallDoc.chatId, currentUserId).catch(() => {});
      return undefined;
    }

    ringTimeoutRef.current = setTimeout(() => {
      markVoiceCallMissed(voiceCallDoc.chatId, currentUserIdRef.current).catch(
        () => {}
      );
    }, msRemaining);

    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [voiceCallDoc, currentUserId]);

  useEffect(() => {
    if (!voiceCallDoc || !isVoiceCallTerminalStatus(voiceCallDoc.status)) {
      return undefined;
    }

    handledTerminalCallRef.current = getVoiceCallTerminalKey(voiceCallDoc);

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    if (listenersCleanupRef.current) {
      listenersCleanupRef.current();
      listenersCleanupRef.current = null;
    }

    try {
      leaveVoiceChannel();
    } catch (_error) {
      // no-op
    }

    releaseVoiceEngine();
    joinedChannelRef.current = "";
    setRuntimeState(DEFAULT_RUNTIME_STATE);
    setVoiceCallDoc(null);

    return undefined;
  }, [voiceCallDoc]);

  useEffect(() => {
    if (
      !voiceCallDoc ||
      voiceCallDoc.status !== VOICE_CALL_STATUSES.ACCEPTED ||
      !currentUserId
    ) {
      return undefined;
    }

    if (joinedChannelRef.current === voiceCallDoc.channelName) {
      return undefined;
    }

    let disposed = false;
    joinedChannelRef.current = voiceCallDoc.channelName;

    const connectVoiceCall = async () => {
      try {
        assertAgoraVoiceReady();
        await ensureMicrophonePermission();

        if (disposed) {
          return;
        }

        setRuntimeState((currentState) => ({
          ...currentState,
          isConnecting: true,
          agoraError: "",
        }));

        if (listenersCleanupRef.current) {
          listenersCleanupRef.current();
          listenersCleanupRef.current = null;
        }

        listenersCleanupRef.current = addAgoraEventListeners({
          onJoinChannelSuccess: () => {
            setRuntimeState((currentState) => ({
              ...currentState,
              joined: true,
              isConnecting: false,
            }));
          },
          onUserJoined: (_connection, remoteUid) => {
            setRuntimeState((currentState) => {
              if (currentState.remoteUsers.includes(remoteUid)) {
                return currentState;
              }

              return {
                ...currentState,
                remoteUsers: [...currentState.remoteUsers, remoteUid],
              };
            });
          },
          onUserOffline: (_connection, remoteUid) => {
            setRuntimeState((currentState) => ({
              ...currentState,
              remoteUsers: currentState.remoteUsers.filter((uid) => uid !== remoteUid),
            }));
          },
          onLeaveChannel: () => {
            setRuntimeState((currentState) => ({
              ...currentState,
              joined: false,
              isConnecting: false,
              remoteUsers: [],
            }));
          },
          onError: (errorCode, message) => {
            console.log("AGORA ERROR:", errorCode, message);
            setRuntimeState((currentState) => ({
              ...currentState,
              agoraError: message || `Agora error ${errorCode}`,
            }));
          },
          onPermissionError: () => {
            Alert.alert("Micro bi tu choi", "Hay cap quyen micro roi thu lai.");
          },
        });

        joinVoiceChannel({
          channelName: voiceCallDoc.channelName,
          firebaseUid: currentUserId,
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        joinedChannelRef.current = "";
        setRuntimeState({
          ...DEFAULT_RUNTIME_STATE,
          agoraError: getFriendlyCallError(error),
        });

        Alert.alert("Khong vao duoc cuoc goi", getFriendlyCallError(error));

        if (voiceCallRef.current?.chatId && currentUserIdRef.current) {
          endVoiceCall(voiceCallRef.current.chatId, currentUserIdRef.current).catch(
            () => {}
          );
        }
      }
    };

    connectVoiceCall();

    return () => {
      disposed = true;
    };
  }, [voiceCallDoc, currentUserId]);

  const activeCall = buildUiVoiceCall(voiceCallDoc, currentUserId, runtimeState);
  const busy = Boolean(activeCall);

  const startCall = async ({ chatId, otherUserId, otherUserName }) => {
    try {
      if (!chatId || !otherUserId) {
        throw new Error("Khong tim thay thong tin phong chat.");
      }

      if (busy) {
        if (activeCall?.chatId === chatId) {
          return true;
        }

        throw new Error("Ban dang co cuoc goi khac. Hay ket thuc cuoc goi hien tai.");
      }

      assertAgoraVoiceReady();
      await ensureMicrophonePermission();

      const caller = auth.currentUser;

      if (!caller?.uid) {
        throw new Error("Ban can dang nhap de su dung tinh nang goi.");
      }

      await startVoiceCall({
        chatId,
        callerId: caller.uid,
        callerName: caller.displayName || caller.email || "Ban",
        calleeId: otherUserId,
        calleeName: otherUserName || "Nguoi dung",
      });

      return true;
    } catch (error) {
      Alert.alert("Khong the bat dau cuoc goi", getFriendlyCallError(error));
      return false;
    }
  };

  const acceptIncomingCallPress = async () => {
    try {
      if (
        !voiceCallDoc ||
        voiceCallDoc.status !== VOICE_CALL_STATUSES.RINGING ||
        currentUserId !== voiceCallDoc.calleeId
      ) {
        return;
      }

      assertAgoraVoiceReady();
      await ensureMicrophonePermission();
      await acceptVoiceCall(voiceCallDoc.chatId, currentUserId);
    } catch (error) {
      Alert.alert("Khong the nhan cuoc goi", getFriendlyCallError(error));
    }
  };

  const declineIncomingCallPress = async () => {
    if (
      !voiceCallDoc ||
      voiceCallDoc.status !== VOICE_CALL_STATUSES.RINGING ||
      currentUserId !== voiceCallDoc.calleeId
    ) {
      return;
    }

    await declineVoiceCall(voiceCallDoc.chatId, currentUserId);
  };

  const endCurrentCall = async () => {
    if (!voiceCallDoc || !currentUserId) {
      return;
    }

    if (
      voiceCallDoc.status === VOICE_CALL_STATUSES.RINGING &&
      currentUserId === voiceCallDoc.calleeId
    ) {
      await declineVoiceCall(voiceCallDoc.chatId, currentUserId);
      return;
    }

    await endVoiceCall(voiceCallDoc.chatId, currentUserId);
  };

  const toggleMute = () => {
    const nextMuted = !runtimeState.isMuted;

    try {
      setMicrophoneMuted(nextMuted);
      setRuntimeState((currentState) => ({
        ...currentState,
        isMuted: nextMuted,
      }));
    } catch (error) {
      Alert.alert("Khong doi duoc micro", getFriendlyCallError(error));
    }
  };

  const toggleSpeaker = () => {
    const nextSpeakerOn = !runtimeState.isSpeakerOn;

    try {
      setSpeakerEnabled(nextSpeakerOn);
      setRuntimeState((currentState) => ({
        ...currentState,
        isSpeakerOn: nextSpeakerOn,
      }));
    } catch (error) {
      Alert.alert("Khong doi duoc loa", getFriendlyCallError(error));
    }
  };

  const overlayTitle = activeCall
    ? activeCall.direction === "incoming" &&
      activeCall.status === VOICE_CALL_STATUSES.RINGING
      ? "Cuoc goi den"
      : activeCall.status === VOICE_CALL_STATUSES.RINGING
        ? "Dang goi..."
        : activeCall.remoteUsers.length > 0
          ? "Dang tro chuyen"
          : "Dang ket noi"
    : "";

  const overlaySubtitle = activeCall
    ? activeCall.status === VOICE_CALL_STATUSES.RINGING
      ? activeCall.direction === "incoming"
        ? "Nhan may de bat dau noi chuyen bang micro."
        : "Dang cho dau ben kia chap nhan cuoc goi."
      : activeCall.joined
        ? "Ket noi am thanh da san sang."
        : "Dang vao phong voice cua Agora."
    : "";

  return (
    <VoiceCallContext.Provider
      value={{
        activeCall,
        busy,
        startCall,
        endCurrentCall,
      }}
    >
      {children}

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(activeCall)}
        onRequestClose={endCurrentCall}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.callCard}>
            <View style={styles.callIconWrap}>
              <Ionicons
                name={
                  activeCall?.status === VOICE_CALL_STATUSES.ACCEPTED
                    ? "call"
                    : "call-outline"
                }
                size={28}
                color="#1677FF"
              />
            </View>

            <Text style={styles.callTitle}>{overlayTitle}</Text>
            <Text style={styles.callName}>{activeCall?.otherUserName}</Text>
            <Text style={styles.callSubtitle}>{overlaySubtitle}</Text>

            {activeCall?.agoraError ? (
              <Text style={styles.callError}>{activeCall.agoraError}</Text>
            ) : null}

            {activeCall?.status === VOICE_CALL_STATUSES.ACCEPTED ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.roundButton,
                    activeCall.isMuted && styles.roundButtonActive,
                  ]}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={activeCall.isMuted ? "mic-off" : "mic"}
                    size={20}
                    color={activeCall.isMuted ? "#fff" : "#111827"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roundButton,
                    activeCall.isSpeakerOn && styles.roundButtonBlue,
                  ]}
                  onPress={toggleSpeaker}
                >
                  <Ionicons
                    name={activeCall.isSpeakerOn ? "volume-high" : "volume-low"}
                    size={20}
                    color={activeCall.isSpeakerOn ? "#fff" : "#111827"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roundButton, styles.endCallButton]}
                  onPress={endCurrentCall}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : activeCall?.direction === "incoming" ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.largeButton, styles.declineButton]}
                  onPress={declineIncomingCallPress}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                  <Text style={styles.largeButtonText}>Tu choi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.largeButton, styles.acceptButton]}
                  onPress={acceptIncomingCallPress}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.largeButtonText}>Nghe may</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.largeButton, styles.declineButton]}
                  onPress={endCurrentCall}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.largeButtonText}>Huy cuoc goi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </VoiceCallContext.Provider>
  );
}

export const useVoiceCall = () => useContext(VoiceCallContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.56)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  callCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  callIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1677FF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  callName: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  callSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
    textAlign: "center",
  },
  callError: {
    marginTop: 12,
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  actionRow: {
    marginTop: 24,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  roundButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonActive: {
    backgroundColor: "#111827",
  },
  roundButtonBlue: {
    backgroundColor: "#1677FF",
  },
  endCallButton: {
    backgroundColor: "#EF4444",
  },
  largeButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptButton: {
    backgroundColor: "#1677FF",
  },
  declineButton: {
    backgroundColor: "#EF4444",
  },
  largeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
