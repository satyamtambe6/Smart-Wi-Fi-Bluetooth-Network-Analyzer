
import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  Animated,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

import {
  RadioTower,
  Wifi,
  Map,
  Bluetooth,
  ArrowUpRight,
  House,
} from 'lucide-react-native';

import type { LucideIcon } from 'lucide-react-native';

import WifiCheckerScreen from './src/screens/WifiCheckerScreen';
import BluetoothCheckerScreen from './src/screens/BluetoothCheckerScreen';
import SignalMapScreen from './src/screens/SignalMapScreen';
import IndoorMapScreen from './src/screens/IndoorMapScreen';

const COLORS = {
  background: '#080B10',
  wifiCard: '#102631',
  mapCard: '#191E32',
  bluetoothCard: '#202019',
  indoorCard: '#172A2B',
  white: '#FFFFFF',
  muted: '#8B98A9',
  cyan: '#67E8F9',
  lavender: '#A5B4FC',
  yellow: '#FDE68A',
  mint: '#6EE7B7',
  navActive: '#17212D',
  border: '#202733',
};

type Screen = 'home' | 'wifi' | 'bluetooth' | 'map' | 'indoorMap';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  background: string;
  color: string;
  Icon: LucideIcon;
  onPress: () => void;
  large?: boolean;
}

function FeatureCard({
  title,
  subtitle,
  background,
  color,
  Icon,
  onPress,
  large = false,
}: FeatureCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: background },
        large ? styles.largeCard : styles.smallCard,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={large ? styles.largeTitle : styles.smallTitle}>
            {title}
          </Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>

        <Icon
          size={large ? 62 : 48}
          color={color}
          strokeWidth={1.8}
        />
      </View>

      <View style={styles.cardBottom}>
        <Text style={[styles.cardAction, { color }]}>
          {large
            ? 'Check Now'
            : title === 'Signal Map'
              ? 'Find weak areas'
              : title === 'Indoor Map'
                ? 'Map your room'
                : 'Find devices'}
        </Text>
        <ArrowUpRight size={22} color={color} />
      </View>
    </TouchableOpacity>
  );
}

interface NavItemProps {
  title: string;
  Icon: LucideIcon;
  active: boolean;
  onPress: () => void;
  color: string;
}

function NavItem({
  title,
  Icon,
  active,
  onPress,
  color,
}: NavItemProps) {
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          styles.navIconContainer,
          active && styles.navIconActive,
        ]}
      >
        <Icon
          size={22}
          color={active ? color : COLORS.muted}
          strokeWidth={active ? 2.3 : 1.8}
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.navLabel,
          active && { color, fontWeight: '700' },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    screenOpacity.setValue(0);
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [currentScreen, screenOpacity]);

  const navigation = {
    goBack: () => setCurrentScreen('home'),
    navigate: (screen: string) => {
      if (
        ['home', 'wifi', 'bluetooth', 'map', 'indoorMap'].includes(screen)
      ) {
        setCurrentScreen(screen as Screen);
      }
    },
  };

  function renderHome() {
    return (
      <SafeAreaView style={styles.homeSafeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />

        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.appName}>SignalScope</Text>
              <Text style={styles.tagline}>
                Your wireless connections
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <RadioTower size={30} color={COLORS.cyan} />
            </View>
          </View>

          <FeatureCard
            title="Wi-Fi"
            subtitle="Check signal and speed"
            background={COLORS.wifiCard}
            color={COLORS.cyan}
            Icon={Wifi}
            large
            onPress={() => setCurrentScreen('wifi')}
          />

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <FeatureCard
                title="Signal Map"
                subtitle="Find weak areas outdoors"
                background={COLORS.mapCard}
                color={COLORS.lavender}
                Icon={Map}
                onPress={() => setCurrentScreen('map')}
              />
            </View>

            <View style={styles.gridItem}>
              <FeatureCard
                title="Bluetooth"
                subtitle="Find nearby devices"
                background={COLORS.bluetoothCard}
                color={COLORS.yellow}
                Icon={Bluetooth}
                onPress={() => setCurrentScreen('bluetooth')}
              />
            </View>
          </View>

          <View style={styles.indoorCardContainer}>
            <FeatureCard
              title="Indoor Map"
              subtitle="Map Wi-Fi strength inside your room"
              background={COLORS.indoorCard}
              color={COLORS.mint}
              Icon={House}
              onPress={() => setCurrentScreen('indoorMap')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function renderActiveScreen() {
    switch (currentScreen) {
      case 'wifi':
        return <WifiCheckerScreen navigation={navigation} />;

      case 'bluetooth':
        return <BluetoothCheckerScreen navigation={navigation} />;

      case 'map':
        return (
          <SignalMapScreen
            navigation={{
              goBack: navigation.goBack,
            }}
          />
        );

      case 'indoorMap':
        return (
          <IndoorMapScreen
            navigation={{
              goBack: navigation.goBack,
            }}
          />
        );

      default:
        return renderHome();
    }
  }

  return (
    <SafeAreaView style={styles.appSafeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />

      <View style={styles.appContainer}>
        {/* Active screen occupies the space above navigation */}
        <Animated.View style={[styles.screenContent, { opacity: screenOpacity }]} key={currentScreen}>
          {renderActiveScreen()}
        </Animated.View>

        {/* Shared bottom navigation stays visible on every screen */}
        <View style={styles.bottomNav}>
          <NavItem
            title="Home"
            Icon={House}
            color={COLORS.cyan}
            active={currentScreen === 'home'}
            onPress={() => setCurrentScreen('home')}
          />

          <NavItem
            title="Wi-Fi"
            Icon={Wifi}
            color={COLORS.cyan}
            active={currentScreen === 'wifi'}
            onPress={() => setCurrentScreen('wifi')}
          />

          <NavItem
            title="Bluetooth"
            Icon={Bluetooth}
            color={COLORS.yellow}
            active={currentScreen === 'bluetooth'}
            onPress={() => setCurrentScreen('bluetooth')}
          />

          <NavItem
            title="Outdoor"
            Icon={Map}
            color={COLORS.lavender}
            active={currentScreen === 'map'}
            onPress={() => setCurrentScreen('map')}
          />

          <NavItem
            title="Indoor"
            Icon={House}
            color={COLORS.mint}
            active={currentScreen === 'indoorMap'}
            onPress={() => setCurrentScreen('indoorMap')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  appContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screenContent: {
    flex: 1,
    minHeight: 0,
  },

  homeSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  homeScroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },

  appName: {
    fontSize: 27,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  tagline: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#17212D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    borderRadius: 25,
    padding: 20,
    justifyContent: 'space-between',
  },

  largeCard: {
    minHeight: 205,
    marginBottom: 18,
    padding: 24,
  },

  smallCard: {
    minHeight: 220,
    flex: 1,
    padding: 16,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },

  cardText: {
    flex: 1,
    gap: 8,
  },

  largeTitle: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '700',
  },

  smallTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },

  cardSubtitle: {
    color: '#B7C5D0',
    fontSize: 12,
    lineHeight: 18,
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },

  cardAction: {
    fontSize: 14,
    fontWeight: '600',
  },

  grid: {
    flexDirection: 'row',
    gap: 12,
  },

  gridItem: {
    flex: 1,
    minWidth: 0,
  },

  indoorCardContainer: {
    marginTop: 14,
  },

  bottomNav: {
    minHeight: 70,
    paddingTop: 7,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 0,
  },

  navIconContainer: {
    width: 48,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconActive: {
    backgroundColor: COLORS.navActive,
  },

  navLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '500',
  },
});
