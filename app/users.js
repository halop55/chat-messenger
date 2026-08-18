import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import UserAvatar from "../components/UserAvatar";
import { pickAvatarImage } from "../components/pickAvatarImage";
import { auth, db } from "../src/config/firebase";
import {
  logoutUser,
  updateCurrentUserAvatar,
} from "../src/services/authServices";
import {
  getConversationPreview,
  getStatusLabel,
  isUserOnline,
} from "../src/utils/chatUi";

const normalizeSearchText = (value = "") =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

export default function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(true);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [submittedSearchText, setSubmittedSearchText] = useState("");
  const [presenceNow, setPresenceNow] = useState(Date.now());
  const normalizedSearchText = normalizeSearchText(submittedSearchText);
  const filteredUsers = useMemo(() => {
    if (!normalizedSearchText) {
      return users;
    }

    return users.filter((user) =>
      normalizeSearchText(user?.name).includes(normalizedSearchText)
    );
  }, [normalizedSearchText, users]);
  const currentUserName =
    currentUserProfile?.name ||
    auth.currentUser?.displayName ||
    "Tai khoan cua ban";
  const currentUserStatus = updatingAvatar
    ? "Dang cap nhat avatar..."
    : getStatusLabel(currentUserProfile, presenceNow);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (querySnapshot) => {
        const list = [];
        let nextCurrentUserProfile = null;

        querySnapshot.forEach((userDoc) => {
          const data = userDoc.data();

          if (data.uid === auth.currentUser?.uid) {
            nextCurrentUserProfile = data;
            return;
          }

          list.push(data);
        });

        setUsers(list);
        setCurrentUserProfile(nextCurrentUserProfile);
        setRefreshing(false);
      },
      (error) => {
        console.log("LOAD USERS ERROR:", error);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setPresenceNow(Date.now());
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSearchTextChange = (value) => {
    setSearchText(value);

    if (!value.trim()) {
      setSubmittedSearchText("");
    }
  };

  const handleSearchSubmit = () => {
    setSubmittedSearchText(searchText);
    Keyboard.dismiss();
  };

  const openChat = (user) => {
    router.push(
      `/chat?otherUserId=${user.uid}&otherUserName=${encodeURIComponent(
        user.name
      )}`
    );
  };

  const handleChangeAvatar = async () => {
    try {
      const selectedAvatar = await pickAvatarImage();
      if (!selectedAvatar?.dataUri) return;

      setUpdatingAvatar(true);
      await updateCurrentUserAvatar(selectedAvatar.dataUri);
      Alert.alert("Thanh cong", "Avatar da duoc cap nhat.");
    } catch (error) {
      console.log("UPDATE AVATAR ERROR:", error);
      Alert.alert(
        "Khong the doi avatar",
        error?.message || "Da co loi xay ra."
      );
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace("/login");
    } catch (error) {
      console.log("LOGOUT ERROR:", error);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topRow}>
        <View style={styles.topContent}>
          <View style={styles.currentUserRow}>
            <View style={styles.currentUserProfile}>
              <UserAvatar
                name={currentUserName}
                email={currentUserProfile?.email || auth.currentUser?.email}
                seed={auth.currentUser?.uid}
                photoURL={currentUserProfile?.photoURL}
                size={56}
                showOnline
                isOnline={isUserOnline(currentUserProfile, presenceNow)}
              />

              <View style={styles.currentUserText}>
                <Text style={styles.currentUserName}>{currentUserName}</Text>
                <View style={styles.currentUserStatusRow}>
                  <View
                    style={[
                      styles.currentUserStatusDot,
                      !isUserOnline(currentUserProfile, presenceNow) &&
                        styles.currentUserStatusDotOffline,
                    ]}
                  />
                  <Text style={styles.currentUserStatus}>
                    {currentUserStatus}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleChangeAvatar}
                disabled={updatingAvatar}
              >
                {updatingAvatar ? (
                  <ActivityIndicator size="small" color="#1677FF" />
                ) : (
                  <Ionicons name="settings-outline" size={20} color="#1677FF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>
            Ket noi nhanh chong voi danh sach nguoi dung trong app
          </Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        {refreshing ? (
          <ActivityIndicator size="small" color="#1677FF" />
        ) : (
          <TouchableOpacity style={styles.searchIconButton} onPress={handleSearchSubmit}>
            <Ionicons name="search" size={20} color="#1677FF" />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.searchInput}
          placeholder="Nhap ten nguoi dung"
          placeholderTextColor="#94A3B8"
          value={searchText}
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openChat(item)}>
            <UserAvatar
              name={item.name}
              email={item.email}
              seed={item.uid}
              photoURL={item.photoURL}
              size={58}
              showOnline
              isOnline={isUserOnline(item, presenceNow)}
            />

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.timeText}>
                  {isUserOnline(item, presenceNow) ? "Online" : ""}
                </Text>
              </View>

              <Text style={styles.preview} numberOfLines={1}>
                {getConversationPreview(item)}
              </Text>

              <Text
                style={[
                  styles.statusText,
                  !isUserOnline(item, presenceNow) && styles.statusTextOffline,
                ]}
              >
                {getStatusLabel(item, presenceNow)}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Chua co nguoi dung khac</Text>
            <Text style={styles.emptyText}>
              Hay tao them tai khoan de bat dau nhan tin.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F7FF",
    paddingHorizontal: 20,
  },
  topRow: {
    marginTop: 4,
  },
  topContent: {
    width: "100%",
  },
  currentUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  currentUserProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  currentUserText: {
    marginLeft: 12,
    flex: 1,
  },
  currentUserName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  currentUserStatusRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentUserStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  currentUserStatusDotOffline: {
    backgroundColor: "#94A3B8",
  },
  currentUserStatus: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748B",
  },
  logoutButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    marginTop: 22,
    marginBottom: 18,
    backgroundColor: "#E8F0FE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "700",
  },
  preview: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#1677FF",
    fontWeight: "700",
  },
  statusTextOffline: {
    color: "#64748B",
  },
  emptyState: {
    marginTop: 70,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});
