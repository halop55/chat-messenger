import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

let agoraModule = null;
let rtcEngine = null;
let rtcEngineInitialized = false;
let currentChannelName = "";
const ANDROID_NATIVE_RUN_COMMAND = "npm run android:run";

const buildAgoraError = (code, message, cause) => {
  const error = new Error(message);
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
};

const ensureAgoraSuccess = (result, action) => {
  if (typeof result === "number" && result < 0) {
    throw buildAgoraError(
      "AGORA_SDK_ERROR",
      `Agora ${action} that bai voi ma ${result}.`
    );
  }
};

const loadAgoraModule = () => {
  if (Platform.OS === "web") {
    throw buildAgoraError(
      "AGORA_WEB_UNSUPPORTED",
      "Goi thoai chi ho tro tren Android va iOS."
    );
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw buildAgoraError(
      "AGORA_EXPO_GO_UNSUPPORTED",
      `Expo Go khong ho tro react-native-agora. Hay cai ban Android native bang ${ANDROID_NATIVE_RUN_COMMAND} de goi duoc.`
    );
  }

  if (agoraModule) {
    return agoraModule;
  }

  try {
    agoraModule = require("react-native-agora");
    return agoraModule;
  } catch (error) {
    throw buildAgoraError(
      "AGORA_NATIVE_MODULE_UNAVAILABLE",
      `Native module cua Agora chua san sang. Hay build lai Android app bang ${ANDROID_NATIVE_RUN_COMMAND}.`,
      error
    );
  }
};

export const getAgoraAppId = () =>
  String(
    process.env.EXPO_PUBLIC_AGORA_APP_ID ||
      Constants.expoConfig?.extra?.agoraAppId ||
      ""
  ).trim();

export const getAgoraTempToken = () =>
  String(
    process.env.EXPO_PUBLIC_AGORA_TEMP_TOKEN ||
      Constants.expoConfig?.extra?.agoraTempToken ||
      ""
  ).trim();

export const getAgoraSetupHelp = () =>
  `Can tao file .env voi EXPO_PUBLIC_AGORA_APP_ID. De test goi thoai tren Android, hay chay ${ANDROID_NATIVE_RUN_COMMAND}.`;

export const getVoiceCallAvailability = () => {
  if (Platform.OS === "web") {
    return {
      supported: false,
      code: "AGORA_WEB_UNSUPPORTED",
      message: "Goi thoai chi ho tro tren Android va iOS.",
    };
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return {
      supported: false,
      code: "AGORA_EXPO_GO_UNSUPPORTED",
      message:
        `Expo Go van mo app va chat duoc, nhung react-native-agora chi goi duoc tren ban Android native cai bang ${ANDROID_NATIVE_RUN_COMMAND}.`,
    };
  }

  if (!getAgoraAppId()) {
    return {
      supported: false,
      code: "AGORA_APP_ID_MISSING",
      message: "Chua cau hinh EXPO_PUBLIC_AGORA_APP_ID.",
    };
  }

  return {
    supported: true,
    code: "AGORA_READY",
    message: "",
  };
};

export const assertAgoraVoiceReady = () => {
  const availability = getVoiceCallAvailability();

  if (!availability.supported) {
    throw buildAgoraError(availability.code, availability.message);
  }

  loadAgoraModule();
};

const ensureRtcEngine = () => {
  assertAgoraVoiceReady();
  const agora = loadAgoraModule();

  if (!rtcEngine) {
    rtcEngine = agora.createAgoraRtcEngine();
  }

  if (!rtcEngineInitialized) {
    ensureAgoraSuccess(
      rtcEngine.initialize({ appId: getAgoraAppId() }),
      "initialize"
    );
    ensureAgoraSuccess(
      rtcEngine.setChannelProfile(
        agora.ChannelProfileType.ChannelProfileCommunication
      ),
      "setChannelProfile"
    );
    ensureAgoraSuccess(
      rtcEngine.setAudioProfile(
        agora.AudioProfileType.AudioProfileDefault,
        agora.AudioScenarioType.AudioScenarioMeeting
      ),
      "setAudioProfile"
    );
    ensureAgoraSuccess(rtcEngine.enableAudio(), "enableAudio");
    ensureAgoraSuccess(rtcEngine.enableLocalAudio(true), "enableLocalAudio");
    ensureAgoraSuccess(
      rtcEngine.setDefaultAudioRouteToSpeakerphone(true),
      "setDefaultAudioRouteToSpeakerphone"
    );
    ensureAgoraSuccess(
      rtcEngine.setEnableSpeakerphone(true),
      "setEnableSpeakerphone"
    );
    ensureAgoraSuccess(
      rtcEngine.enableAudioVolumeIndication(300, 3, true),
      "enableAudioVolumeIndication"
    );
    rtcEngineInitialized = true;
  }

  return { agora, engine: rtcEngine };
};

export const addAgoraEventListeners = (handlers = {}) => {
  const { engine } = ensureRtcEngine();
  const listenerEntries = Object.entries(handlers).filter(
    ([, listener]) => typeof listener === "function"
  );

  listenerEntries.forEach(([eventName, listener]) => {
    engine.addListener(eventName, listener);
  });

  return () => {
    listenerEntries.forEach(([eventName, listener]) => {
      engine.removeListener(eventName, listener);
    });
  };
};

export const buildAgoraUid = (firebaseUid = "") => {
  const source = String(firebaseUid || "guest");
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalized = hash >>> 0;
  return normalized === 0 ? 1 : normalized;
};

export const joinVoiceChannel = ({ channelName, firebaseUid }) => {
  const { agora, engine } = ensureRtcEngine();
  const localAgoraUid = buildAgoraUid(firebaseUid);

  if (currentChannelName && currentChannelName !== channelName) {
    ensureAgoraSuccess(engine.leaveChannel(), "leaveChannel");
    currentChannelName = "";
  }

  ensureAgoraSuccess(
    engine.setEnableSpeakerphone(true),
    "setEnableSpeakerphone"
  );
  ensureAgoraSuccess(engine.muteLocalAudioStream(false), "muteLocalAudioStream");
  ensureAgoraSuccess(
    engine.joinChannel(getAgoraTempToken(), channelName, localAgoraUid, {
      channelProfile: agora.ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: false,
      autoSubscribeAudio: true,
      autoSubscribeVideo: false,
      enableAudioRecordingOrPlayout: true,
    }),
    "joinChannel"
  );

  currentChannelName = channelName;
  return localAgoraUid;
};

export const setMicrophoneMuted = (muted) => {
  if (!rtcEngineInitialized || !rtcEngine) {
    return;
  }

  ensureAgoraSuccess(
    rtcEngine.muteLocalAudioStream(Boolean(muted)),
    "muteLocalAudioStream"
  );
};

export const setSpeakerEnabled = (enabled) => {
  if (!rtcEngineInitialized || !rtcEngine) {
    return;
  }

  ensureAgoraSuccess(
    rtcEngine.setEnableSpeakerphone(Boolean(enabled)),
    "setEnableSpeakerphone"
  );
};

export const leaveVoiceChannel = () => {
  if (!rtcEngineInitialized || !rtcEngine) {
    return;
  }

  ensureAgoraSuccess(rtcEngine.leaveChannel(), "leaveChannel");
  currentChannelName = "";
};

export const releaseVoiceEngine = () => {
  if (!rtcEngine) {
    return;
  }

  try {
    rtcEngine.removeAllListeners();
  } catch (_error) {
    // no-op
  }

  try {
    rtcEngine.release();
  } catch (_error) {
    // no-op
  }

  rtcEngine = null;
  rtcEngineInitialized = false;
  currentChannelName = "";
};
