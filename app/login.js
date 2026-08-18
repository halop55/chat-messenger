import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { loginUser } from "../src/services/authServices";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

//  const handleLogin = async () => {
//    try {
//      if (!email || !password) {
//        Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
//        return;
//      }
//
//      await loginUser(email.trim(), password);
//      router.replace("/users");
//    } catch (error) {
//      Alert.alert("Lỗi đăng nhập", error.message);
//    }
//  };
const handleLogin = async () => {
  try {
    if (!email || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
      return;
    }

    await loginUser(email.trim(), password);
    router.replace("/users");
  } catch (error) {
    console.log("LOGIN ERROR FULL:", JSON.stringify(error, null, 2));
    console.log("LOGIN ERROR CODE:", error?.code);
    console.log("LOGIN ERROR MESSAGE:", error?.message);

    Alert.alert(
      "Lỗi đăng nhập",
      `${error?.code || "NO_CODE"}\n${error?.message || "Không rõ lỗi"}`
    );
  }
};

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.kicker}>Welcome back</Text>
        <Text style={styles.title}>Đăng nhập để tiếp tục cuộc trò chuyện</Text>
        <Text style={styles.subtitle}>
          Giao diện được làm mới theo kiểu Messenger, giữ nguyên phần xử lý đăng nhập từ project cũ.
        </Text>
      </View>

      <View style={styles.card}>
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

        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập mật khẩu"
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Vào Messenger</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Chưa có tài khoản? Tạo ngay</Text>
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
