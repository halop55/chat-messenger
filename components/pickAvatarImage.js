import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export const pickAvatarImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      "Chua cap quyen",
      "Can cho phep truy cap thu vien anh de chon avatar."
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.3,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType || "image/jpeg";

  return {
    ...asset,
    previewUri: asset.uri,
    dataUri: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : "",
  };
};
