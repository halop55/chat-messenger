import { onAuthStateChanged } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { AppState } from "react-native";
import { auth, db } from "../config/firebase";

const PRESENCE_HEARTBEAT_MS = 60 * 1000;

const writePresence = async (user, online) => {
  if (!user?.uid) {
    return;
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      online,
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const setCurrentUserPresence = async (online) => {
  await writePresence(auth.currentUser, online);
};

export const startPresenceTracking = () => {
  let currentUser = auth.currentUser;
  let currentAppState = AppState.currentState;
  let heartbeatId = null;

  const stopHeartbeat = () => {
    if (heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
  };

  const markOnline = () => {
    if (!currentUser?.uid) {
      return;
    }

    writePresence(currentUser, true).catch(() => {});
    stopHeartbeat();
    heartbeatId = setInterval(() => {
      writePresence(currentUser, true).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);
  };

  const markOffline = () => {
    stopHeartbeat();

    if (!currentUser?.uid) {
      return;
    }

    writePresence(currentUser, false).catch(() => {});
  };

  const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
    if (currentUser?.uid && currentUser.uid !== nextUser?.uid) {
      writePresence(currentUser, false).catch(() => {});
    }

    currentUser = nextUser;

    if (!currentUser?.uid) {
      stopHeartbeat();
      return;
    }

    if (currentAppState === "active") {
      markOnline();
      return;
    }

    markOffline();
  });

  const appStateSubscription = AppState.addEventListener("change", (nextState) => {
    currentAppState = nextState;

    if (nextState === "active") {
      markOnline();
      return;
    }

    markOffline();
  });

  if (currentUser?.uid && currentAppState === "active") {
    markOnline();
  }

  return () => {
    stopHeartbeat();
    markOffline();
    unsubscribeAuth();
    appStateSubscription.remove();
  };
};
