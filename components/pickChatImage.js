import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

const MAX_IMAGE_DATA_URI_LENGTH = 850000;

export const pickChatImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      "Chua cap quyen",
      "Can cho phep truy cap thu vien anh de gui anh trong cuoc tro chuyen."
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.3,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType || "image/jpeg";
  const dataUri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : "";

  if (!dataUri) {
    Alert.alert("Khong the doc anh", "Thu lai voi mot anh khac.");
    return null;
  }

  if (dataUri.length > MAX_IMAGE_DATA_URI_LENGTH) {
    Alert.alert(
      "Anh qua lon",
      "Hay chon anh nhe hon de gui nhanh va tranh loi luu tru."
    );
    return null;
  }

  return {
    ...asset,
    previewUri: asset.uri,
    dataUri,
  };
};
