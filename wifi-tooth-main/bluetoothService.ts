import { BleManager, Device } from "react-native-ble-plx";
import RNBluetoothClassic, {
  BluetoothDevice,
} from "react-native-bluetooth-classic";
import { PermissionsAndroid, Platform } from "react-native";

const bleManager = new BleManager();

export type NearbyBluetoothDevice = {
  id: string;
  name: string;
  type: "BLE" | "Classic";
  rssi: number | null;
  device: Device | BluetoothDevice;
  isAudioProfile?: boolean;
};

export function isAudioDeviceName(name?: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes("headphone") ||
    lower.includes("ear") ||
    lower.includes("airpod") ||
    lower.includes("buds") ||
    lower.includes("headset") ||
    lower.includes("speaker") ||
    lower.includes("sound") ||
    lower.includes("audio") ||
    lower.includes("boom") ||
    lower.includes("wireless") ||
    lower.includes("tws") ||
    lower.includes("neckband") ||
    lower.includes("music") ||
    lower.includes("stereo") ||
    lower.includes("bt") ||
    lower.includes("pro")
  );
}

export async function requestBluetoothPermissions() {
  if (Platform.OS !== "android") return false;

  if (Number(Platform.Version) >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
      PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}


export async function scanNearbyBluetoothDevices(
  onDevicesUpdated: (devices: NearbyBluetoothDevice[]) => void,
  onError: (message: string) => void
) {
  const granted = await requestBluetoothPermissions();

  if (!granted) {
    onError("Bluetooth permissions were not granted.");
    return () => { };
  }

  const devices = new Map<string, NearbyBluetoothDevice>();

  // Add previously paired Classic devices.
  // These are shown as paired, not necessarily nearby or connected.
  try {
    const pairedDevices = await RNBluetoothClassic.getBondedDevices();

    pairedDevices.forEach((device) => {
      const id = device.address;
      if (!id) return;

      const name = device.name || "Unknown Classic device";

      devices.set(id, {
        id,
        name,
        type: "Classic",
        rssi: null,
        device,
        isAudioProfile: isAudioDeviceName(name),
      });
    });
  } catch {
    // Paired-device list may be unavailable.
  }

  let stopped = false;

  const publish = () => {
    if (!stopped) {
      onDevicesUpdated(Array.from(devices.values()));
    }
  };

  // Scan for BLE devices.
  try {
    bleManager.startDeviceScan(
      null,
      { allowDuplicates: true },
      (error, device) => {
        if (stopped) return;

        if (error) {
          onError(error.message);
          return;
        }

        if (!device) return;

        const id = device.id;
        const previous = devices.get(id);

        devices.set(id, {
          id,
          name:
            device.name ||
            device.localName ||
            previous?.name ||
            "Unknown BLE device",
          type: "BLE",
          rssi: device.rssi ?? previous?.rssi ?? null,
          device,
          isAudioProfile: isAudioDeviceName(
            device.name || device.localName
          ),
        });

        publish();
      }
    );
  } catch {
    onError("Could not start BLE scanning.");
  }

  // Discover nearby Classic Bluetooth devices.
  try {
    const classicDevices = await RNBluetoothClassic.startDiscovery();

    if (!stopped) {
      classicDevices.forEach((device) => {
        const id = device.address || device.id;
        if (!id) return;

        const name = device.name || "Unknown Classic device";

        devices.set(id, {
          id,
          name,
          type: "Classic",
          rssi: null,
          device,
          isAudioProfile: isAudioDeviceName(name),
        });
      });

      publish();
    }
  } catch (error: any) {
    if (!stopped) {
      onError(
        error?.message ||
        "Could not discover Classic Bluetooth devices. Check that Bluetooth is on."
      );
    }
  }

  // Stop both scans when the screen closes.
  return () => {
    stopped = true;
    bleManager.stopDeviceScan();
    RNBluetoothClassic.cancelDiscovery().catch(() => false);
  };
}


export function stopBluetoothScan() {
  bleManager.stopDeviceScan();
}

export function getBleManager() {
  return bleManager;
}

export async function connectToNearbyDevice(
  target: NearbyBluetoothDevice
): Promise<NearbyBluetoothDevice> {
  if (target.type === "BLE") {
    try {
      const connected = await bleManager.connectToDevice(
        target.id,
        { autoConnect: false }
      );

      const ready = await connected.discoverAllServicesAndCharacteristics();

      return {
        ...target,
        device: ready,
        rssi: ready.rssi ?? target.rssi,
      };
    } catch (err: any) {
      throw new Error(err?.message || "Could not connect to BLE device.");
    }
  }

  // Classic Bluetooth connection
  // 1. Verify Bluetooth is enabled on the mobile device
  const isBtEnabled = await RNBluetoothClassic.isBluetoothEnabled().catch(() => false);
  if (!isBtEnabled) {
    throw new Error("Bluetooth is turned off. Please turn on Bluetooth in settings.");
  }

  // 2. Check if the device is bonded (paired with the phone)
  const bondedDevices = await RNBluetoothClassic.getBondedDevices().catch(() => []);
  const bonded = bondedDevices.find(
    (d) => d.address.toLowerCase() === target.id.toLowerCase()
  );

  // If it's a known audio device (headphones, earphone, headset, speaker):
  // Headphones connect at the Android OS audio level (A2DP / HFP profiles)
  // and do NOT support RFCOMM serial sockets. Calling connectToDevice() on them
  // triggers `java.io.IOException: read failed, socket might closed or timeout`.
  if (bonded && (target.isAudioProfile || isAudioDeviceName(target.name))) {
    return {
      ...target,
      device: bonded,
      rssi: target.rssi ?? null,
      isAudioProfile: true,
    };
  }

  // 3. For data/serial Classic devices (e.g. Arduino, HC-05, OBD-II scanners),
  // attempt RFCOMM socket connection
  try {
    const connected = await RNBluetoothClassic.connectToDevice(target.id);
    if (connected) {
      return {
        ...target,
        device: connected,
        rssi: null,
      };
    }
  } catch (classicErr: any) {
    const errMsg = String(classicErr?.message || classicErr || "");

    // If RFCOMM socket failed (e.g. socket closed/timeout/read failed)
    // but the device IS bonded in the user's phone Bluetooth settings:
    if (bonded) {
      // It's connected as a system audio or peripheral device via phone settings
      return {
        ...target,
        device: bonded,
        rssi: target.rssi ?? null,
        isAudioProfile: true,
      };
    }

    throw new Error(
      errMsg.includes("read failed") || errMsg.includes("socket might closed")
        ? "This device is paired through Android settings (Audio Profile). It does not use an RFCOMM data socket."
        : classicErr?.message || "Could not connect to this Classic device."
    );
  }

  return {
    ...target,
    device: bonded || target.device,
    rssi: null,
  };
}

export async function checkBluetoothConnection(
  target: NearbyBluetoothDevice
): Promise<boolean> {
  try {
    const isBtEnabled = await RNBluetoothClassic.isBluetoothEnabled().catch(() => false);
    if (!isBtEnabled) {
      return false;
    }

    if (target.type === "BLE") {
      return await bleManager.isDeviceConnected(target.id);
    }

    // Classic Bluetooth:
    // 1. Check if an active RFCOMM socket connection exists
    const isSocketConnected = await RNBluetoothClassic.isDeviceConnected(target.id).catch(() => false);
    if (isSocketConnected) {
      return true;
    }

    // 2. For Audio / Bonded devices connected via OS settings (like headphones):
    // As long as Bluetooth is on and the device is bonded, consider it connected
    const bondedDevices = await RNBluetoothClassic.getBondedDevices().catch(() => []);
    return bondedDevices.some(
      (d) => d.address.toLowerCase() === target.id.toLowerCase()
    );
  } catch {
    return false;
  }
}

export async function readBluetoothSignal(
  target: NearbyBluetoothDevice
): Promise<number | null> {
  if (target.type !== "BLE") {
    return target.rssi ?? null;
  }

  try {
    const device = await bleManager.readRSSIForDevice(target.id);
    return device.rssi ?? null;
  } catch {
    return target.rssi ?? null;
  }
}

export async function disconnectNearbyDevice(
  target: NearbyBluetoothDevice
): Promise<void> {
  try {
    if (target.type === "BLE") {
      await bleManager.cancelDeviceConnection(target.id);
    } else {
      if (typeof (target.device as any)?.disconnect === 'function') {
        await (target.device as any).disconnect();
      } else {
        await RNBluetoothClassic.disconnectFromDevice(target.id).catch(() => false);
      }
    }
  } catch {
    // Ignore error if already disconnected or managed by OS
  }
}
