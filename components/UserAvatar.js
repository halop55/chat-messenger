import { Image, StyleSheet, Text, View } from "react-native";
import { getAvatarColor, getInitials } from "../src/utils/chatUi";

export default function UserAvatar({
  name,
  email,
  seed,
  photoURL,
  size = 48,
  showOnline = false,
  isOnline = false,
  textScale = 0.32,
}) {
  const safeName = typeof name === 'string' ? name : '';
  const safeEmail = typeof email === 'string' ? email : '';
  const backgroundColor = getAvatarColor(seed || safeName || safeEmail || '');
  const onlineSize = Math.max(10, size * 0.24);

  return (
    <View style={[styles.avatarWrap, { width: size, height: size }]}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={[
            styles.avatarImage,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor,
            },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize: size * textScale }]}>
            {getInitials(safeName, safeEmail)}
          </Text>
        </View>
      )}

      {showOnline && isOnline ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: onlineSize,
              height: onlineSize,
              borderRadius: onlineSize / 2,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    position: "relative",
  },
  avatarImage: {
    backgroundColor: "#E2E8F0",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
