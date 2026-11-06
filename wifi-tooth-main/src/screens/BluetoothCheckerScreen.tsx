import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import {
  ArrowLeft,
  Bluetooth,
  Headphones,
  Speaker,
  RadioTower,
  CheckCircle,
  RefreshCw,
  Ruler,
  XCircle,
} from 'lucide-react-native';
import {
  scanNearbyBluetoothDevices,
  stopBluetoothScan,
  connectToNearbyDevice,
  checkBluetoothConnection,
  readBluetoothSignal,
  disconnectNearbyDevice,
  NearbyBluetoothDevice,
} from '../services/bluetoothService';

const C = {
  bg: '#080B10',
  card: '#151C25',
  blueCard: '#191E32',
  cyanCard: '#102631',
  cyan: '#67E8F9',
  purple: '#A5B4FC',
  green: '#86EFAC',
  yellow: '#FDE68A',
  white: '#FFFFFF',
  muted: '#AAB4C3',
  border: '#26313D',
};

interface BluetoothCheckerScreenProps {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string) => void;
  };
}

function getDeviceIconType(name: string): 'headphones' | 'speaker' | 'bluetooth' {
  const lower = name.toLowerCase();
  if (
    lower.includes('headphone') ||
    lower.includes('ear') ||
    lower.includes('airpod') ||
    lower.includes('buds') ||
    lower.includes('headset') ||
    lower.includes('tws') ||
    lower.includes('neckband')
  ) {
    return 'headphones';
  }
  if (
    lower.includes('speaker') ||
    lower.includes('sound') ||
    lower.includes('audio') ||
    lower.includes('boom')
  ) {
    return 'speaker';
  }
  return 'bluetooth';
}

function DeviceIcon({ name, type }: { name: string; type: 'BLE' | 'Classic' }) {
  const iconType = getDeviceIconType(name);
  if (iconType === 'headphones') return <Headphones size={26} color={C.purple} />;
  if (iconType === 'speaker') return <Speaker size={26} color={C.cyan} />;
  return <Bluetooth size={26} color={type === 'Classic' ? C.yellow : C.purple} />;
}

// RSSI-based distance is an estimate, not an exact physical measurement.
function estimateDistanceMeters(rssi: number | null): number | null {
  if (rssi === null || !Number.isFinite(rssi)) return null;
  // Typical reference RSSI at 1 metre; environment and hardware change this value.
  const txPowerAtOneMeter = -59;
  const pathLossExponent = 2.2;
  const meters = Math.pow(10, (txPowerAtOneMeter - rssi) / (10 * pathLossExponent));
  if (!Number.isFinite(meters)) return null;
  return Math.max(0.1, Math.min(99, meters));
}

export default function BluetoothCheckerScreen({
  navigation,
}: BluetoothCheckerScreenProps) {
  const [devices, setDevices] = useState<NearbyBluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] =
    useState<NearbyBluetoothDevice | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [lastRssi, setLastRssi] = useState<number | null>(null);
  const lastRssiRef = useRef<number | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);

  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    scanNearbyBluetoothDevices(
      (updatedDevices) => {
        if (isMounted) {
          setDevices(updatedDevices);
        }
      },
      (errMsg) => {
        if (isMounted) {
          setError(errMsg);
          setScanning(false);
        }
      }
    )
      .then((stopFn) => {
        if (isMounted) {
          stopScanRef.current = stopFn;
          setScanning(true);
        } else {
          stopFn();
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to start Bluetooth scan.');
          setScanning(false);
        }
      });

    return () => {
      isMounted = false;
      stopBluetoothScan();
      stopScanRef.current?.();
    };
  }, []);

  // Monitor the real Bluetooth connection and live signal
  useEffect(() => {
    if (!testing || !connectedDevice) return;

    let isMounted = true;
    let checking = false;

    const checkConnection = async () => {
      if (checking) return;
      checking = true;

      try {
        const isConnected = await checkBluetoothConnection(connectedDevice);

        if (!isConnected) {
          if (isMounted) {
            const finalRssi = lastRssiRef.current ?? connectedDevice.rssi ?? lastRssi;
            setLastRssi(finalRssi);
            lastRssiRef.current = finalRssi;
            setTesting(false);
            setConnectionLost(true);
            Alert.alert(
              'Connection Lost',
              `Bluetooth connection to ${connectedDevice.name} was lost.`
            );
          }
          return;
        }

        if (connectedDevice.type === 'BLE') {
          const rssi = await readBluetoothSignal(connectedDevice);
          if (isMounted && rssi !== null) {
            setConnectedDevice((previous) =>
              previous ? { ...previous, rssi } : null
            );
            lastRssiRef.current = rssi;
            setLastRssi(rssi);
          }
        }
      } catch {
        // Individual polling failure does not mean disconnected; next tick re-checks
      } finally {
        checking = false;
      }
    };

    const timer = setInterval(checkConnection, 1500);
    void checkConnection();

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [testing, connectedDevice, lastRssi]);

  const toggleScan = async () => {
    if (scanning) {
      stopBluetoothScan();
      stopScanRef.current?.();
      stopScanRef.current = null;
      setScanning(false);
      return;
    }

    try {
      setError(null);
      setScanning(true);
      const stopFn = await scanNearbyBluetoothDevices(
        (updatedDevices) => {
          setDevices(updatedDevices);
        },
        (errMsg) => {
          setError(errMsg);
          setScanning(false);
          Alert.alert('Bluetooth Scan', errMsg);
        }
      );
      stopScanRef.current = stopFn;
    } catch (err: any) {
      const msg = err?.message || 'Failed to start Bluetooth scan.';
      setError(msg);
      setScanning(false);
      Alert.alert('Bluetooth Scan Error', msg);
    }
  };

  const connectDevice = async (device: NearbyBluetoothDevice) => {
    if (testing) {
      Alert.alert('Range Test Active', 'Stop the test before changing devices.');
      return;
    }

    if (connectedDevice?.id === device.id) {
      Alert.alert(
        'Disconnect Device',
        `Do you want to disconnect from ${device.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                await disconnectNearbyDevice(connectedDevice);
              } catch (err: any) {
                Alert.alert('Disconnect Error', err?.message || 'Could not disconnect the device.');
              } finally {
                setConnectedDevice(null);
                setLastRssi(null);
                lastRssiRef.current = null;
                setConnectionLost(false);
                setTesting(false);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      setConnectingId(device.id);
      if (connectedDevice) {
        await disconnectNearbyDevice(connectedDevice);
      }
      const connected = await connectToNearbyDevice(device);
      setConnectedDevice(connected);
      setLastRssi(connected.rssi ?? null);
      lastRssiRef.current = connected.rssi ?? null;
      setConnectionLost(false);
      Alert.alert(
        'Connected',
        connected.isAudioProfile
          ? `Connected to ${device.name} (Audio Profile active in phone settings).`
          : `Successfully connected to ${device.name}`
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to device.';
      Alert.alert('Connection Error', msg);
    } finally {
      setConnectingId(null);
    }
  };

  const startRangeTest = async () => {
    if (!connectedDevice) {
      Alert.alert('Connect a Device', 'Scan and connect to a Bluetooth device first.');
      return;
    }

    try {
      const isConnected = await checkBluetoothConnection(connectedDevice);
      if (!isConnected) {
        Alert.alert(
          'Device Disconnected',
          'Please reconnect to the device before starting the test.'
        );
        return;
      }

      setLastRssi(connectedDevice.rssi ?? null);
      lastRssiRef.current = connectedDevice.rssi ?? null;
      setConnectionLost(false);
      setTesting(true);
    } catch (err: any) {
      Alert.alert('Connection Check', err?.message || 'Could not verify the connection.');
    }
  };

  const stopRangeTest = () => {
    const currentRssi = connectedDevice?.rssi ?? lastRssiRef.current ?? lastRssi;
    setLastRssi(currentRssi);
    lastRssiRef.current = currentRssi;
    setTesting(false);
    setConnectionLost(false);
  };

  const signalLabel = (
    rssi: number | null,
    type: 'BLE' | 'Classic',
    isAudio?: boolean
  ) => {
    if (rssi === null) {
      return isAudio ? 'Paired Audio' : type === 'Classic' ? 'Paired Classic' : 'Signal Unknown';
    }
    if (rssi >= -55) return 'Strong signal';
    if (rssi >= -70) return 'Medium signal';
    return 'Weak signal';
  };

  const signalColor = (rssi: number | null) => {
    if (rssi === null) return C.purple;
    if (rssi >= -55) return C.green;
    if (rssi >= -70) return C.yellow;
    return '#FCA5A5';
  };

  const renderDevice = (device: NearbyBluetoothDevice) => {
    const isConnected = connectedDevice?.id === device.id;
    const isConnecting = connectingId === device.id;
    const color = signalColor(device.rssi);

    return (
      <View key={device.id} style={styles.deviceCard}>
        <View style={styles.deviceRow}>
          <View style={styles.deviceIcon}>
            <DeviceIcon name={device.name} type={device.type} />
          </View>

          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.typeBadge,
                  device.isAudioProfile
                    ? styles.audioBadge
                    : device.type === 'Classic'
                      ? styles.classicBadge
                      : styles.bleBadge,
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {device.isAudioProfile ? 'Audio' : device.type}
                </Text>
              </View>
              <Text style={[styles.deviceSignal, { color }]}>
                {signalLabel(device.rssi, device.type, device.isAudioProfile)}
                {device.rssi !== null ? ` · ${device.rssi} dBm` : ''}
              </Text>
            </View>
            <Text style={styles.deviceId} numberOfLines={1}>
              {device.id}
            </Text>
          </View>

          {isConnected && (
            <CheckCircle size={22} color={C.green} />
          )}
        </View>

        <View style={styles.signalTrack}>
          <View
            style={[
              styles.signalFill,
              {
                backgroundColor: color,
                width: `${device.rssi !== null
                  ? Math.max(5, Math.min(100, Math.round(((device.rssi + 100) / 70) * 100)))
                  : 100
                  }%`,
              },
            ]}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={testing || isConnecting}
          style={[
            styles.connectButton,
            isConnected && styles.connectedButton,
          ]}
          onPress={() => connectDevice(device)}
        >
          {isConnecting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={C.purple} />
              <Text style={styles.connectText}>Connecting...</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.connectText,
                isConnected && { color: C.green },
              ]}
            >
              {isConnected ? 'Connected (Tap to Disconnect)' : 'Connect Device'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={C.bg}
      />

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation?.goBack
                  ? navigation.goBack()
                  : Alert.alert('SignalScope', 'Bluetooth Checker')
              }
            >
              <ArrowLeft size={23} color={C.white} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              Bluetooth Checker
            </Text>
          </View>

          {/* Scanner */}
          <View style={styles.scannerCard}>
            <Bluetooth size={58} color={C.purple} />

            <Text style={styles.scannerTitle}>
              Nearby Devices
            </Text>

            <Text style={styles.subtitle}>
              Find nearby devices and check Bluetooth signal strength
            </Text>

            {error && (
              <View style={styles.errorCard}>
                <XCircle size={18} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.scanButton, scanning && styles.scanningButton]}
              activeOpacity={0.8}
              onPress={toggleScan}
              disabled={testing}
            >
              {scanning ? (
                <ActivityIndicator size="small" color={C.bg} />
              ) : (
                <RefreshCw
                  size={19}
                  color={C.bg}
                />
              )}
              <Text style={styles.scanButtonText}>
                {scanning ? 'Stop Scanning' : 'Scan for Devices'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Device List */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Available Devices
            </Text>
            <Text style={styles.deviceCount}>
              {devices.length} found
            </Text>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Bluetooth size={35} color={C.muted} />
              <Text style={styles.emptyText}>
                {scanning ? 'Searching for devices...' : 'No devices found'}
              </Text>
              <Text style={styles.subtitle}>
                {scanning
                  ? 'Looking for nearby BLE and paired devices'
                  : 'Tap Scan for Devices to begin searching'}
              </Text>
            </View>
          ) : (
            devices.map(renderDevice)
          )}

          {/* Bluetooth Signal Test */}
          <View style={styles.rangeCard}>
            <View style={styles.rangeHeader}>
              <RadioTower size={34} color={C.cyan} />
              <View style={styles.rangeHeaderText}>
                <Text style={styles.rangeTitle}>Bluetooth Signal Test</Text>
                <Text style={styles.subtitle}>
                  {connectedDevice
                    ? `Device: ${connectedDevice.name} (${connectedDevice.isAudioProfile
                      ? 'Audio Profile'
                      : connectedDevice.type
                    })`
                    : 'Connect a device above to begin'}
                </Text>
              </View>
            </View>

            <View style={styles.rangeDivider} />

            <Text style={styles.rangeLabel}>
              {testing
                ? 'Live signal status'
                : connectionLost
                  ? 'Bluetooth connection lost'
                  : lastRssi !== null
                    ? 'Last signal strength'
                    : 'Current signal status'}
            </Text>

            <View style={styles.signalValueRow}>
              <Text style={styles.signalValue}>
                {connectedDevice?.type === 'BLE' &&
                  (testing ? connectedDevice?.rssi : lastRssi ?? connectedDevice?.rssi) !== null &&
                  (testing ? connectedDevice?.rssi : lastRssi ?? connectedDevice?.rssi) !== undefined
                  ? `${testing ? connectedDevice?.rssi : lastRssi ?? connectedDevice?.rssi} dBm`
                  : connectedDevice?.isAudioProfile
                    ? 'RSSI unavailable'
                    : connectedDevice
                      ? 'RSSI unavailable'
                      : 'No device'}
              </Text>
            </View>

            <Text style={styles.rangeLabel}>Estimated distance</Text>
            <Text style={[styles.signalValue, { fontSize: 27, marginTop: 6 }]}>
              {connectedDevice?.type === 'BLE' &&
                estimateDistanceMeters(testing ? connectedDevice.rssi : lastRssi ?? connectedDevice.rssi) !== null
                ? `~${estimateDistanceMeters(testing ? connectedDevice.rssi : lastRssi ?? connectedDevice.rssi)!.toFixed(1)} m`
                : 'Unavailable'}
            </Text>
            <Text style={styles.subtitle}>
              {connectedDevice?.type === 'BLE'
                ? 'Approximation from live signal strength, not an exact measurement.'
                : 'This Classic device does not provide a usable live signal reading through the current app API.'}
            </Text>

            <View style={styles.signalTrackLarge}>
              <View
                style={[
                  styles.signalFillLarge,
                  {
                    width: `${connectedDevice?.rssi !== null && connectedDevice?.rssi !== undefined
                      ? Math.max(10, Math.min(100, ((connectedDevice.rssi + 100) / 70) * 100))
                      : connectedDevice
                        ? 85
                        : 0
                      }%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.rangeNote}>
              {testing
                ? connectedDevice?.type === 'BLE'
                  ? `Monitoring ${connectedDevice.name}. Estimated metres update when fresh BLE signal readings arrive; walls and interference affect accuracy.`
                  : `Actively monitoring Bluetooth link to ${connectedDevice?.name}. Move away to test connection boundary.`
                : connectionLost
                  ? `The connection to ${connectedDevice?.name ?? 'the device'} was lost.`
                  : connectedDevice?.isAudioProfile
                    ? `Connected to ${connectedDevice.name} via phone's Bluetooth settings (Audio profile). Tap Start Signal Test to monitor link status.`
                    : 'Connect a device, then start the test to monitor its real connection and signal strength.'}
            </Text>

            {testing ? (
              <TouchableOpacity style={styles.stopButton} onPress={stopRangeTest}>
                <XCircle size={20} color={C.white} />
                <Text style={styles.stopButtonText}>Stop Test</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.rangeButton, !connectedDevice && styles.disabledButton]}
                onPress={startRangeTest}
                disabled={!connectedDevice}
              >
                <Ruler size={20} color={C.bg} />
                <Text style={styles.rangeButtonText}>Start Signal Test</Text>
              </TouchableOpacity>
            )}

            {connectionLost && (
              <View style={styles.resultCard}>
                <CheckCircle size={23} color={C.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>Test Finished</Text>
                  <Text style={styles.subtitle}>
                    Last status: {lastRssi !== null ? `${lastRssi} dBm` : 'Connection Lost'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>


      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: '700',
  },
  scannerCard: {
    backgroundColor: C.blueCard,
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    marginBottom: 27,
  },
  scannerTitle: {
    color: C.white,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 15,
  },
  subtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#381616',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    width: '100%',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
  },
  scanButton: {
    backgroundColor: C.purple,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  scanningButton: {
    backgroundColor: '#818CF8',
  },
  scanButtonText: {
    color: C.bg,
    fontWeight: '700',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 19,
    fontWeight: '700',
  },
  deviceCount: {
    color: C.purple,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 22,
    gap: 5,
  },
  emptyText: {
    color: C.white,
    fontWeight: '600',
    fontSize: 15,
    marginTop: 8,
  },
  deviceCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    backgroundColor: '#242D3B',
    width: 53,
    height: 53,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
    gap: 3,
  },
  deviceName: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bleBadge: {
    backgroundColor: '#3730A3',
  },
  classicBadge: {
    backgroundColor: '#713F12',
  },
  audioBadge: {
    backgroundColor: '#065F46',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.white,
  },
  deviceSignal: {
    fontSize: 12,
  },
  deviceId: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signalTrack: {
    height: 6,
    backgroundColor: '#29303C',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 14,
  },
  signalFill: {
    height: '100%',
    borderRadius: 20,
  },
  connectButton: {
    borderWidth: 1,
    borderColor: C.purple,
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  connectedButton: {
    borderColor: C.green,
  },
  connectText: {
    color: C.purple,
    fontSize: 14,
    fontWeight: '600',
  },
  rangeCard: {
    backgroundColor: C.cyanCard,
    borderRadius: 25,
    padding: 21,
    marginTop: 12,
  },
  rangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  rangeHeaderText: {
    flex: 1,
    gap: 3,
  },
  rangeTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
  },
  rangeDivider: {
    height: 1,
    backgroundColor: '#31505A',
    marginVertical: 20,
  },
  rangeLabel: {
    color: C.muted,
    fontSize: 13,
  },
  signalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 8,
  },
  signalValue: {
    color: C.cyan,
    fontSize: 32,
    fontWeight: '800',
  },
  signalTrackLarge: {
    height: 8,
    borderRadius: 20,
    backgroundColor: '#243D48',
    overflow: 'hidden',
    marginTop: 16,
  },
  signalFillLarge: {
    height: '100%',
    borderRadius: 20,
    backgroundColor: C.cyan,
  },
  rangeNote: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    marginBottom: 18,
  },
  rangeButton: {
    backgroundColor: C.cyan,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  disabledButton: {
    opacity: 0.5,
  },
  rangeButtonText: {
    color: C.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: '#9F3434',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  stopButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#172B27',
    padding: 14,
    borderRadius: 14,
    marginTop: 15,
  },
  resultTitle: {
    color: C.green,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNav: {
    height: 65,
    borderTopWidth: 1,
    borderTopColor: '#202733',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
});
