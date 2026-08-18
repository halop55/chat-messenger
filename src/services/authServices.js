import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { setCurrentUserPresence } from "./presenceServices";

const normalizeAvatar = (avatarUri = "") => avatarUri || "";
const isRemotePhotoURL = (photoURL = "") => /^https?:\/\//i.test(photoURL);

export const registerUser = async (name, email, password, avatarUri = "") => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const photoURL = normalizeAvatar(avatarUri);

  const profilePayload = { displayName: name };
  if (isRemotePhotoURL(photoURL)) {
    profilePayload.photoURL = photoURL;
  }

  await updateProfile(result.user, profilePayload);

  await setDoc(doc(db, "users", result.user.uid), {
    uid: result.user.uid,
    name,
    email,
    photoURL,
    online: true,
    lastActive: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return result.user;
};

export const loginUser = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const logoutUser = async () => {
  await setCurrentUserPresence(false);
  await signOut(auth);
};

export const updateCurrentUserAvatar = async (avatarUri) => {
  if (!auth.currentUser?.uid) {
    throw new Error("USER_NOT_AUTHENTICATED");
  }

  const photoURL = normalizeAvatar(avatarUri);
  const profileUpdates = isRemotePhotoURL(photoURL) ? { photoURL } : null;

  await Promise.all([
    profileUpdates ? updateProfile(auth.currentUser, profileUpdates) : Promise.resolve(),
    setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || "",
        email: auth.currentUser.email || "",
        photoURL,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return photoURL;
};
