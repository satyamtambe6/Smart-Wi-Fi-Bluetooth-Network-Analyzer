import WifiManager from "react-native-wifi-reborn";
import { PermissionsAndroid, Platform } from "react-native";

export async function getWifiDetails() {
  if (Platform.OS !== "android") {
    throw new Error("Android only");
  }

  const permission = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );

  if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Location permission is needed to read Wi-Fi details.");
  }

  const connected = await WifiManager.connectionStatus();

  if (!connected) {
    throw new Error("Please connect your phone to Wi-Fi first.");
  }

  const [strength, frequency] = await Promise.all([
    WifiManager.getCurrentSignalStrength(),
    WifiManager.getFrequency(),
  ]);

  return {
    strength,
    frequency,
  };
}
