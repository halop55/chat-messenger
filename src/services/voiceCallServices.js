import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const VOICE_CALL_COLLECTION = "voiceCalls";
export const VOICE_CALL_INBOX_COLLECTION = "voiceCallInbox";
export const VOICE_CALL_RING_DURATION_MS = 45_000;

export const VOICE_CALL_STATUSES = {
  RINGING: "ringing",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  ENDED: "ended",
  MISSED: "missed",
};

const ACTIVE_VOICE_CALL_STATUSES = new Set([
  VOICE_CALL_STATUSES.RINGING,
  VOICE_CALL_STATUSES.ACCEPTED,
]);

const TERMINAL_VOICE_CALL_STATUSES = new Set([
  VOICE_CALL_STATUSES.DECLINED,
  VOICE_CALL_STATUSES.ENDED,
  VOICE_CALL_STATUSES.MISSED,
]);

const toMillis = (value) => {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
};

const getVoiceCallRef = (chatId) => doc(db, VOICE_CALL_COLLECTION, chatId);
const getVoiceCallInboxRef = (uid) => doc(db, VOICE_CALL_INBOX_COLLECTION, uid);

const normalizeVoiceCall = (snapshot) => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    ...data,
    createdAtMs: data?.createdAtMs || toMillis(data?.createdAt),
    updatedAtMs:
      data?.updatedAtMs || toMillis(data?.updatedAt) || toMillis(data?.createdAt),
    acceptedAtMs: data?.acceptedAtMs || toMillis(data?.acceptedAt),
    endedAtMs: data?.endedAtMs || toMillis(data?.endedAt),
  };
};

export const buildVoiceChannelName = (chatId = "") =>
  `voice_${String(chatId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 58)}`;

export const isVoiceCallActiveStatus = (status) =>
  ACTIVE_VOICE_CALL_STATUSES.has(status);

export const isVoiceCallTerminalStatus = (status) =>
  TERMINAL_VOICE_CALL_STATUSES.has(status);

export const getVoiceCallPeer = (voiceCall, currentUserId) => {
  if (!voiceCall) {
    return null;
  }

  const isCaller = currentUserId === voiceCall.callerId;

  return {
    uid: isCaller ? voiceCall.calleeId : voiceCall.callerId,
    name: isCaller ? voiceCall.calleeName : voiceCall.callerName,
  };
};

const loadVoiceCall = async (chatId) => {
  const snapshot = await getDoc(getVoiceCallRef(chatId));

  if (!snapshot.exists()) {
    throw new Error("VOICE_CALL_NOT_FOUND");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

const syncVoiceCallInboxes = async ({
  voiceCall,
  status,
  activeCallId,
  now = Date.now(),
}) => {
  const basePayload = {
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
    status,
    activeCallId,
    chatId: activeCallId ? voiceCall.chatId : null,
    channelName: activeCallId ? voiceCall.channelName : null,
    callerId: activeCallId ? voiceCall.callerId : null,
    callerName: activeCallId ? voiceCall.callerName : null,
    calleeId: activeCallId ? voiceCall.calleeId : null,
    calleeName: activeCallId ? voiceCall.calleeName : null,
    participantIds: activeCallId ? voiceCall.participantIds : [],
  };

  await Promise.all([
    setDoc(
      getVoiceCallInboxRef(voiceCall.callerId),
      {
        uid: voiceCall.callerId,
        role: "caller",
        ...basePayload,
      },
      { merge: true }
    ),
    setDoc(
      getVoiceCallInboxRef(voiceCall.calleeId),
      {
        uid: voiceCall.calleeId,
        role: "callee",
        ...basePayload,
      },
      { merge: true }
    ),
  ]);
};

export const startVoiceCall = async ({
  chatId,
  callerId,
  callerName,
  calleeId,
  calleeName,
}) => {
  const now = Date.now();
  const voiceCall = {
    chatId,
    channelName: buildVoiceChannelName(chatId),
    callerId,
    callerName,
    calleeId,
    calleeName,
    participantIds: [callerId, calleeId],
  };

  await setDoc(
    getVoiceCallRef(chatId),
    {
      ...voiceCall,
      status: VOICE_CALL_STATUSES.RINGING,
      createdAt: serverTimestamp(),
      createdAtMs: now,
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
      ringTimeoutAt: now + VOICE_CALL_RING_DURATION_MS,
      acceptedAt: null,
      acceptedAtMs: null,
      answeredBy: null,
      endedAt: null,
      endedAtMs: null,
      endedBy: null,
    },
    { merge: true }
  );

  await syncVoiceCallInboxes({
    voiceCall,
    status: VOICE_CALL_STATUSES.RINGING,
    activeCallId: chatId,
    now,
  });
};

export const acceptVoiceCall = async (chatId, userId) => {
  const now = Date.now();
  const voiceCall = await loadVoiceCall(chatId);

  await updateDoc(getVoiceCallRef(chatId), {
    status: VOICE_CALL_STATUSES.ACCEPTED,
    acceptedAt: serverTimestamp(),
    acceptedAtMs: now,
    answeredBy: userId,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });

  await syncVoiceCallInboxes({
    voiceCall,
    status: VOICE_CALL_STATUSES.ACCEPTED,
    activeCallId: chatId,
    now,
  });
};

export const declineVoiceCall = async (chatId, userId) => {
  const now = Date.now();
  const voiceCall = await loadVoiceCall(chatId);

  await updateDoc(getVoiceCallRef(chatId), {
    status: VOICE_CALL_STATUSES.DECLINED,
    endedAt: serverTimestamp(),
    endedAtMs: now,
    endedBy: userId,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });

  await syncVoiceCallInboxes({
    voiceCall,
    status: VOICE_CALL_STATUSES.DECLINED,
    activeCallId: null,
    now,
  });
};

export const markVoiceCallMissed = async (chatId, userId) => {
  const now = Date.now();
  const voiceCall = await loadVoiceCall(chatId);

  await updateDoc(getVoiceCallRef(chatId), {
    status: VOICE_CALL_STATUSES.MISSED,
    endedAt: serverTimestamp(),
    endedAtMs: now,
    endedBy: userId,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });

  await syncVoiceCallInboxes({
    voiceCall,
    status: VOICE_CALL_STATUSES.MISSED,
    activeCallId: null,
    now,
  });
};

export const endVoiceCall = async (chatId, userId) => {
  const now = Date.now();
  const voiceCall = await loadVoiceCall(chatId);

  await updateDoc(getVoiceCallRef(chatId), {
    status: VOICE_CALL_STATUSES.ENDED,
    endedAt: serverTimestamp(),
    endedAtMs: now,
    endedBy: userId,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });

  await syncVoiceCallInboxes({
    voiceCall,
    status: VOICE_CALL_STATUSES.ENDED,
    activeCallId: null,
    now,
  });
};

export const subscribeUserVoiceCalls = (uid, callback) => {
  const voiceCallsQuery = query(
    collection(db, VOICE_CALL_COLLECTION),
    where("participantIds", "array-contains", uid)
  );

  return onSnapshot(voiceCallsQuery, (snapshot) => {
    callback(snapshot.docs.map(normalizeVoiceCall));
  });
};

export const subscribeVoiceCallInbox = (uid, callback) =>
  onSnapshot(getVoiceCallInboxRef(uid), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  });

export const subscribeVoiceCall = (chatId, callback) =>
  onSnapshot(getVoiceCallRef(chatId), (snapshot) => {
    callback(snapshot.exists() ? normalizeVoiceCall(snapshot) : null);
  });
