import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  ArrowLeft,
  Wifi,
  Download,
  Upload,
  Activity,
  RadioTower,
  Map,
  ChevronRight,
} from 'lucide-react-native';
import { getWifiDetails } from '../services/wifiService';
import { runSpeedTest as executeSpeedTest } from '../services/speedTestService';

const C = {
  bg: '#080B10',
  card: '#151C25',
  wifi: '#102631',
  cyan: '#67E8F9',
  lavender: '#A5B4FC',
  green: '#86EFAC',
  yellow: '#FDE68A',
  white: '#FFFFFF',
  muted: '#AAB4C3',
  border: '#26313D',
};

interface WifiCheckerScreenProps {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string) => void;
  };
}

interface MetricCardProps {
  title: string;
  value: string;
  Icon: any;
  color: string;
}

function MetricCard({ title, value, Icon, color }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Icon size={27} color={color} strokeWidth={1.8} />
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function WifiCheckerScreen({ navigation }: WifiCheckerScreenProps) {
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wifiData, setWifiData] = useState<{ strength: number; frequency: number } | null>(null);
  const [speedData, setSpeedData] = useState<{
    ping: number;
    downloadMbps: number;
    uploadMbps: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showMessage = (title: string) => {
    Alert.alert(title, 'This feature will be connected next.');
  };

  const showSignalMapComingSoon = () => {
    Alert.alert(
      'Coming Soon',
      'The Signal Map feature is currently under maintenance and will be available in an upcoming update.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const checkWifiDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await getWifiDetails();
      setWifiData(details);
    } catch (err: any) {
      const msg = err?.message || 'Failed to read Wi-Fi details.';
      setError(msg);
      Alert.alert('Wi-Fi Details', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    getWifiDetails()
      .then((details) => {
        if (isMounted) {
          setWifiData(details);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to read Wi-Fi details.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getSignalStatus = (strength: number) => {
    if (strength >= -50) return { label: 'Excellent Signal', color: C.green };
    if (strength >= -65) return { label: 'Strong Signal', color: C.cyan };
    if (strength >= -75) return { label: 'Fair Signal', color: C.yellow };
    return { label: 'Weak Signal', color: '#F87171' };
  };

  const getSignalPercentage = (strength: number) => {
    return Math.max(5, Math.min(100, Math.round(((strength + 100) / 70) * 100)));
  };

  const formatFrequency = (freq: number) => {
    if (!freq) return '—';
    if (freq >= 5000) return `${(freq / 1000).toFixed(1)} GHz`;
    if (freq >= 1000) return `${(freq / 1000).toFixed(1)} GHz`;
    return `${freq} MHz`;
  };

  const signalInfo = wifiData ? getSignalStatus(wifiData.strength) : null;
  const signalPercentage = wifiData ? getSignalPercentage(wifiData.strength) : 0;

  const handleRunSpeedTest = async () => {
    try {
      setTesting(true);
      const results = await executeSpeedTest();
      setSpeedData(results);
      Alert.alert(
        'Speed Test Complete',
        `Ping: ${results.ping} ms\nDownload: ${results.downloadMbps} Mbps\nUpload: ${results.uploadMbps} Mbps`
      );
    } catch (err: any) {
      const msg = err?.message || 'Speed test failed.';
      Alert.alert('Speed Test Error', msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                navigation?.goBack
                  ? navigation.goBack()
                  : showMessage('Back')
              }
              style={styles.backButton}
            >
              <ArrowLeft size={23} color={C.white} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Wi-Fi Checker</Text>
          </View>

          {/* Signal Strength Card */}
          <TouchableOpacity
            style={styles.signalCard}
            activeOpacity={0.85}
            onPress={checkWifiDetails}
          >
            <Wifi size={48} color={signalInfo ? signalInfo.color : C.cyan} strokeWidth={1.7} />

            <Text style={styles.connectedTitle}>Connected Wi-Fi</Text>
            <Text style={styles.subtitle}>
              {loading ? 'Reading Wi-Fi hardware details...' : error ? error : 'Tap card to refresh signal'}
            </Text>

            <Text
              style={[
                styles.signalStatus,
                { color: signalInfo ? signalInfo.color : loading ? C.cyan : C.muted },
              ]}
            >
              {loading ? 'Checking...' : signalInfo ? signalInfo.label : 'No Signal Read'}
            </Text>
            <Text style={styles.signalValue}>
              {loading ? '...' : wifiData ? `${wifiData.strength} dBm` : error ? 'Tap to Retry' : '—'}
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${signalPercentage}%`,
                    backgroundColor: signalInfo ? signalInfo.color : C.cyan,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Check Wi-Fi Action Button */}
          <TouchableOpacity
            style={[styles.checkButton, loading && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={checkWifiDetails}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={C.white} style={{ marginRight: 8 }} />
            ) : (
              <Wifi size={20} color={C.white} style={{ marginRight: 8 }} />
            )}
            <Text style={styles.checkButtonText}>
              {loading ? 'Checking Wi-Fi...' : 'Check Wi-Fi Signal'}
            </Text>
          </TouchableOpacity>

          {/* Network Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <MetricCard
                title="Download"
                value={testing ? 'Testing...' : speedData ? `${speedData.downloadMbps} Mbps` : '—'}
                Icon={Download}
                color={C.cyan}
              />
            </View>

            <View style={styles.metricItem}>
              <MetricCard
                title="Upload"
                value={testing ? 'Testing...' : speedData ? `${speedData.uploadMbps} Mbps` : '—'}
                Icon={Upload}
                color={C.lavender}
              />
            </View>

            <View style={styles.metricItem}>
              <MetricCard
                title="Ping"
                value={testing ? 'Testing...' : speedData ? `${speedData.ping} ms` : '—'}
                Icon={Activity}
                color={C.green}
              />
            </View>

            <View style={styles.metricItem}>
              <MetricCard
                title="Frequency"
                value={loading ? '...' : wifiData ? formatFrequency(wifiData.frequency) : '—'}
                Icon={RadioTower}
                color={C.yellow}
              />
            </View>
          </View>

          {/* Speed Test Button */}
          <TouchableOpacity
            style={[styles.speedButton, testing && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleRunSpeedTest}
            disabled={testing}
          >
            {testing && (
              <ActivityIndicator size="small" color={C.bg} style={{ marginRight: 8 }} />
            )}
            <Text style={styles.speedButtonText}>
              {testing ? 'Testing Speed...' : 'Run Speed Test'}
            </Text>
          </TouchableOpacity>

          {/* Signal Map Link */}
          <TouchableOpacity
            style={styles.coverageCard}
            activeOpacity={0.8}
            onPress={showSignalMapComingSoon}
          >
            <Map size={30} color={C.lavender} />

            <View style={styles.coverageText}>
              <Text style={styles.coverageTitle}>
                Check Wi-Fi Coverage
              </Text>
              <Text style={styles.coverageSubtitle}>
                Find weak signal areas around you
              </Text>
            </View>

            <ChevronRight size={22} color={C.muted} />
          </TouchableOpacity>
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
    marginBottom: 24,
    marginTop: 8,
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
    fontSize: 23,
    fontWeight: '700',
  },

  signalCard: {
    backgroundColor: C.wifi,
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    marginBottom: 16,
  },

  connectedTitle: {
    color: C.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },

  signalStatus: {
    color: C.cyan,
    fontSize: 25,
    fontWeight: '700',
    marginTop: 22,
  },

  signalValue: {
    color: C.white,
    fontSize: 16,
    marginTop: 7,
  },

  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#243D48',
    borderRadius: 20,
    marginTop: 20,
    overflow: 'hidden',
  },

  progressFill: {
    width: '85%',
    height: '100%',
    backgroundColor: C.cyan,
    borderRadius: 20,
  },

  checkButton: {
    backgroundColor: '#0E7490',
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  checkButtonText: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 18,
  },

  metricItem: {
    width: '50%',
    padding: 5,
  },

  metricCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 17,
    minHeight: 135,
    justifyContent: 'center',
    gap: 9,
  },

  metricTitle: {
    color: C.muted,
    fontSize: 13,
  },

  metricValue: {
    color: C.white,
    fontSize: 21,
    fontWeight: '700',
  },

  speedButton: {
    backgroundColor: C.cyan,
    borderRadius: 18,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  speedButtonText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: '700',
  },

  coverageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 19,
    padding: 18,
    gap: 13,
  },

  coverageText: {
    flex: 1,
    gap: 6,
  },

  coverageTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },

  coverageSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
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
