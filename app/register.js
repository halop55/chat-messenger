import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "../components/UserAvatar";
import { pickAvatarImage } from "../components/pickAvatarImage";
import { registerUser } from "../src/services/authServices";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePickAvatar = async () => {
    const selectedAvatar = await pickAvatarImage();
    if (selectedAvatar) {
      setAvatar(selectedAvatar);
    }
  };

  const handleRegister = async () => {
    try {
      if (!name || !email || !password) {
        Alert.alert("Loi", "Vui long nhap day du thong tin");
        return;
      }

      setLoading(true);
      await registerUser(name.trim(), email.trim(), password, avatar?.dataUri);
      Alert.alert("Thanh cong", "Dang ky thanh cong");
      router.replace("/users");
    } catch (error) {
      Alert.alert(
        "Loi dang ky",
        `${error?.code || "NO_CODE"} | ${error?.message || "Khong ro loi"}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.kicker}>Create profile</Text>
        <Text style={styles.title}>Tao tai khoan voi avatar tuy chinh</Text>
        <Text style={styles.subtitle}>
          Ban co the chon anh dai dien ngay khi dang ky, va van co the doi lai
          sau trong danh sach chat.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarSection}>
          <UserAvatar
            name={name}
            email={email}
            seed={email || name}
            photoURL={avatar?.previewUri}
            size={88}
          />

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handlePickAvatar}
            disabled={loading}
          >
            <Ionicons name="image-outline" size={18} color="#1677FF" />
            <Text style={styles.avatarButtonText}>
              {avatar ? "Doi avatar" : "Chon avatar"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Ten hien thi</Text>
        <TextInput
          style={styles.input}
          placeholder="Vi du: Nguyen An"
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#94A3B8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Mat khau</Text>
        <TextInput
          style={styles.input}
          placeholder="Toi thieu 6 ky tu"
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Bat dau tro chuyen</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/login")}
          disabled={loading}
        >
          <Text style={styles.linkText}>Da co tai khoan? Dang nhap</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F7FF",
    paddingHorizontal: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  header: {
    marginTop: 26,
    marginBottom: 28,
  },
  kicker: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1677FF",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "#475569",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E8F0FE",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarButtonText: {
    color: "#1677FF",
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 18,
    fontSize: 15,
    color: "#111827",
  },
  button: {
    backgroundColor: "#1677FF",
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  linkButton: {
    marginTop: 18,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: "#1677FF",
    fontWeight: "700",
  },
});
