

import React, { useEffect, useRef, useState } from "react";

import {

    View,

    Text,

    StyleSheet,

    TouchableOpacity,

    Alert,

    ActivityIndicator,

    ScrollView,

} from "react-native";

import { WebView } from "react-native-webview";

import * as Location from "expo-location";

import { getWifiDetails } from "../services/wifiService";



type SignalMapScreenProps = {

    navigation: {

        goBack: () => void;

    };

};



type SignalPoint = {

    id: string;

    latitude: number;

    longitude: number;

    strength: number;

    frequency: number;

    timestamp: number;

};



export default function SignalMapScreen({

    navigation,

}: SignalMapScreenProps) {

    const mapRef = useRef<WebView>(null);

    const [region, setRegion] = useState<{

        latitude: number;

        longitude: number;

    } | null>(null);

    const [points, setPoints] = useState<SignalPoint[]>([]);

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    const [currentStrength, setCurrentStrength] = useState<number | null>(null);

    const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);

    const [mapReady, setMapReady] = useState(false);
    const [, setSelectedPointId] = useState<string | null>(null);



    const strongCount = points.filter((p) => p.strength >= -55).length;

    const mediumCount = points.filter(

        (p) => p.strength < -55 && p.strength >= -70

    ).length;

    const weakCount = points.filter((p) => p.strength < -70).length;



    useEffect(() => {

        loadLocation();

    }, []);



    function sendToMap(data: object) {

        mapRef.current?.injectJavaScript(`

      if (window.receiveFromApp) {

        window.receiveFromApp(${JSON.stringify(JSON.stringify(data))});

      }

      true;

    `);

    }



    async function loadLocation() {

        try {

            const permission =

                await Location.requestForegroundPermissionsAsync();



            if (permission.status !== "granted") {

                Alert.alert(

                    "Location permission required",

                    "Allow location access to show your position on the map."

                );

                return;

            }



            const lastKnown = await Location.getLastKnownPositionAsync({});
            const location =
                lastKnown ??
                (await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                }));

            setRegion({

                latitude: location.coords.latitude,

                longitude: location.coords.longitude,

            });

        } catch {

            Alert.alert("Error", "Could not get your current location.");

        } finally {

            setLoading(false);

        }

    }



    useEffect(() => {

        if (!mapReady || !region) return;



        sendToMap({

            type: "currentLocation",

            latitude: region.latitude,

            longitude: region.longitude,

        });



        points.forEach((point) => {

            sendToMap({

                type: "reading",

                id: point.id,

                latitude: point.latitude,

                longitude: point.longitude,

                strength: point.strength,

                frequency: point.frequency,

                timestamp: point.timestamp,

            });

        });

    }, [mapReady, region, points]);



    async function saveReading() {

        try {

            setSaving(true);



            const permission =

                await Location.requestForegroundPermissionsAsync();



            if (permission.status !== "granted") {

                Alert.alert(

                    "Permission required",

                    "Allow location access first."

                );

                return;

            }



            const [lastKnown, wifi] = await Promise.all([
                Location.getLastKnownPositionAsync({}),
                getWifiDetails(),
            ]);
            const location =
                lastKnown ??
                (await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                }));



            const strength = Number(wifi.strength);

            const frequency = Number(wifi.frequency);



            if (!Number.isFinite(strength)) {

                throw new Error("Could not read a valid Wi-Fi signal strength.");

            }



            const point: SignalPoint = {

                id: `${Date.now()}`,

                latitude: location.coords.latitude,

                longitude: location.coords.longitude,

                strength,

                frequency,

                timestamp: Date.now(),

            };



            setCurrentStrength(strength);

            setCurrentFrequency(frequency);

            setPoints((previous) => [...previous, point]);



            sendToMap({

                type: "reading",

                id: point.id,

                latitude: point.latitude,

                longitude: point.longitude,

                strength: point.strength,

                frequency: point.frequency,

                timestamp: point.timestamp,

            });



            Alert.alert(

                "Reading saved",

                `Wi-Fi strength: ${point.strength} dBm`

            );

        } catch (error) {

            Alert.alert(

                "Could not save reading",

                error instanceof Error ? error.message : "Please try again."

            );

        } finally {

            setSaving(false);

        }

    }



    function focusReading(point: SignalPoint) {
        setSelectedPointId(point.id);
        sendToMap({
            type: "focus",
            latitude: point.latitude,
            longitude: point.longitude,
            id: point.id,
        });
    }



    if (loading) {

        return (

            <View style={styles.center}>

                <ActivityIndicator size="large" />

                <Text style={styles.loadingText}>Loading your location...</Text>

            </View>

        );

    }



    if (!region) {

        return (

            <View style={styles.center}>

                <Text style={styles.loadingText}>Location is unavailable.</Text>

                <TouchableOpacity style={styles.button} onPress={loadLocation}>

                    <Text style={styles.buttonText}>Try Again</Text>

                </TouchableOpacity>

                <TouchableOpacity

                    style={styles.backButton}

                    onPress={navigation.goBack}

                >

                    <Text style={styles.backButtonText}>Back to Home</Text>

                </TouchableOpacity>

            </View>

        );

    }



    return (

        <View style={styles.container}>

            <WebView

                ref={mapRef}

                style={styles.map}

                originWhitelist={["*"]}

                javaScriptEnabled

                domStorageEnabled

                onMessage={(event) => {

                    if (event.nativeEvent.data === "MAP_READY") {

                        setMapReady(true);

                    }

                }}

                source={{

                    html: `

            <!DOCTYPE html>

            <html>

            <head>

              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">

              <link

                href="https\://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css"

                rel="stylesheet"

              />

              <style>

                
                  .signal-marker {
                    width: 32px;
                    height: 32px;
                    border: 2px solid #ffffff;
                    border-radius: 50%;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                    font: 700 11px Arial, sans-serif;
                  }
                  .signal-marker.selected-marker {
                    outline: 5px solid rgba(23,105,255,0.45);
                    box-shadow: 0 0 0 8px rgba(23,105,255,0.20), 0 3px 8px rgba(0,0,0,0.45);
                    width: 40px;
                    height: 40px;
                    z-index: 999 !important;
                  }
                  .current-location-marker {
                    color: #1769FF;
                    font-size: 30px;
                    line-height: 30px;
                  }

                  html, body, #map {

                  margin: 0;

                  padding: 0;

                  width: 100%;

                  height: 100%;

                  overflow: hidden;

                }

              </style>

            </head>

            <body>

              <div id="map"></div>

              <script src="https\://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>

              <script>

                const map = new maplibregl.Map({

                  container: 'map',

                  style: 'https\://tiles.openfreemap.org/styles/liberty',

                  center: [${region.longitude}, ${region.latitude}],

                  zoom: 15

                });



                map.addControl(

                  new maplibregl.NavigationControl(),

                  'top-right'

                );



                
                  const readingMarkers = {};
                  let currentLocationMarker = null;
                  let selectedMarkerId = null;
                  const heatFeatures = [];

                  function markerColor(strength) {
                    return strength >= -55 ? '#16834A' :
                           strength >= -70 ? '#D6A500' : '#D92D20';
                  }

                  function makeMarkerElement(id, strength) {
                    const el = document.createElement('div');
                    el.className = 'signal-marker';
                    el.dataset.markerId = String(id);
                    el.style.backgroundColor = markerColor(strength);
                    el.textContent = String(Number(id) || '');
                    return el;
                  }

                  function selectMarker(id) {
                    selectedMarkerId = String(id);
                    Object.keys(readingMarkers).forEach(function(key) {
                      readingMarkers[key].getElement().classList.toggle(
                        'selected-marker', key === selectedMarkerId
                      );
                    });
                  }

                  function updateHeatmap() {
                    const source = map.getSource('signal-heat-source');
                    if (source) {
                      source.setData({
                        type: 'FeatureCollection',
                        features: heatFeatures
                      });
                    }
                  }

                  window.receiveFromApp = function(rawData) {
                    const data = JSON.parse(rawData);

                    if (data.type === 'currentLocation') {
                      map.flyTo({
                        center: [data.longitude, data.latitude],
                        zoom: Math.max(map.getZoom(), 16),
                        duration: 700
                      });
                      if (currentLocationMarker) currentLocationMarker.remove();

                      const currentEl = document.createElement('div');
                      currentEl.className = 'current-location-marker';
                      currentEl.textContent = '●';
                      currentLocationMarker = new maplibregl.Marker({
                        element: currentEl,
                        anchor: 'center'
                      })
                        .setLngLat([data.longitude, data.latitude])
                        .setPopup(new maplibregl.Popup().setText('Your location'))
                        .addTo(map);
                    }

                    if (data.type === 'focus') {
                      const id = String(data.id);
                      const target = [data.longitude, data.latitude];
                      selectMarker(id);
                      map.flyTo({
                        center: target,
                        zoom: 20,
                        duration: 1200,
                        essential: true
                      });
                      const marker = readingMarkers[id];
                      if (marker && marker.getPopup()) {
                        marker.getPopup().addTo(map);
                      }
                    }

                    if (data.type === 'reading') {
                      const id = String(data.id);
                      if (readingMarkers[id]) readingMarkers[id].remove();

                      const markerNumber = Object.keys(readingMarkers).length + 1;
                      const el = makeMarkerElement(markerNumber, Number(data.strength));
                      const marker = new maplibregl.Marker({
                        element: el,
                        anchor: 'bottom'
                      })
                        .setLngLat([data.longitude, data.latitude])
                        .setPopup(new maplibregl.Popup({ offset: 26 }).setText(
                          'Reading #' + id.slice(-4) + ' | Wi-Fi: ' +
                          data.strength + ' dBm | Frequency: ' +
                          data.frequency + ' MHz'
                        ))
                        .addTo(map);
                      readingMarkers[id] = marker;

                      const feature = {
                        type: 'Feature',
                        properties: {
                          id: id,
                          strength: Number(data.strength),
                          color: markerColor(Number(data.strength))
                        },
                        geometry: {
                          type: 'Point',
                          coordinates: [data.longitude, data.latitude]
                        }
                      };
                      const index = heatFeatures.findIndex(function(f) {
                        return String(f.properties.id) === id;
                      });
                      if (index >= 0) heatFeatures[index] = feature;
                      else heatFeatures.push(feature);
                      updateHeatmap();
                      if (selectedMarkerId === id) selectMarker(id);
                    }
                  };

                  map.on('load', function() {
                    map.addSource('signal-heat-source', {
                      type: 'geojson',
                      data: { type: 'FeatureCollection', features: [] }
                    });
                    map.addLayer({
                      id: 'signal-heat-layer',
                      type: 'circle',
                      source: 'signal-heat-source',
                      paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 14, 16, 28, 20, 44],
                        'circle-color': ['get', 'color'],
                        'circle-blur': 0.9,
                        'circle-opacity': 0.28,
                        'circle-stroke-width': 0
                      }
                    });
                    window.ReactNativeWebView.postMessage('MAP_READY');
                  });

              </script>

            </body>

            </html>

          `,

                }}

            />



            <View style={styles.infoCard}>

                <ScrollView

                    style={styles.panelScroll}

                    nestedScrollEnabled

                    showsVerticalScrollIndicator

                >

                    <TouchableOpacity

                        style={styles.backButton}

                        onPress={navigation.goBack}

                    >

                        <Text style={styles.backButtonText}>← Back to Home</Text>

                    </TouchableOpacity>



                    <Text style={styles.heading}>Wi-Fi Signal Map</Text>



                    <View style={styles.signalCard}>

                        <Text style={styles.signalLabel}>CURRENT WI-FI SIGNAL</Text>

                        <Text style={styles.signalValue}>

                            {currentStrength !== null

                                ? `${currentStrength} dBm`

                                : "Not measured yet"}

                        </Text>

                        <Text style={styles.signalQuality}>

                            {currentStrength === null

                                ? "Save a reading to begin"

                                : currentStrength >= -55

                                    ? "🟢 Strong signal"

                                    : currentStrength >= -70

                                        ? "🟡 Medium signal"

                                        : "🔴 Weak signal"}

                        </Text>

                        <Text style={styles.subtitle}>

                            Frequency: {currentFrequency !== null

                                ? `${currentFrequency} MHz`

                                : "--"}

                        </Text>

                    </View>



                    <Text style={styles.subtitle}>

                        Saved readings: {points.length}

                    </Text>



                    <View style={styles.summaryRow}>

                        <View style={[styles.summaryCard, styles.strongCard]}>

                            <Text style={[styles.summaryCount, { color: "#16794B" }]}>

                                {strongCount}

                            </Text>

                            <Text style={[styles.summaryLabel, { color: "#16794B" }]}>

                                Strong

                            </Text>

                        </View>



                        <View style={[styles.summaryCard, styles.mediumCard]}>

                            <Text style={[styles.summaryCount, { color: "#92400E" }]}>

                                {mediumCount}

                            </Text>

                            <Text style={[styles.summaryLabel, { color: "#92400E" }]}>

                                Medium

                            </Text>

                        </View>



                        <View style={[styles.summaryCard, styles.weakCard]}>

                            <Text style={[styles.summaryCount, { color: "#B91C1C" }]}>

                                {weakCount}

                            </Text>

                            <Text style={[styles.summaryLabel, { color: "#B91C1C" }]}>

                                Weak

                            </Text>

                        </View>

                    </View>



                    <TouchableOpacity

                        style={[styles.button, saving && styles.disabledButton]}

                        onPress={saveReading}

                        disabled={saving}

                    >

                        <Text style={styles.buttonText}>

                            {saving ? "Saving reading..." : "Save Current Signal"}

                        </Text>

                    </TouchableOpacity>



                    <Text style={styles.legend}>

                        🟢 Strong   🟡 Medium   🔴 Weak

                    </Text>



                    <View style={styles.recentSection}>

                        <Text style={styles.recentTitle}>Recent Readings</Text>



                        {points.length === 0 ? (

                            <Text style={styles.emptyText}>No readings saved yet.</Text>

                        ) : (

                            [...points].reverse().slice(0, 5).map((point) => {

                                const quality =

                                    point.strength >= -55

                                        ? "Strong"

                                        : point.strength >= -70

                                            ? "Medium"

                                            : "Weak";



                                const color =

                                    quality === "Strong"

                                        ? "#16794B"

                                        : quality === "Medium"

                                            ? "#92400E"

                                            : "#B91C1C";



                                return (

                                    <TouchableOpacity

                                        key={point.id}

                                        style={styles.recentItem}

                                        onPress={() => focusReading(point)}

                                    >

                                        <View style={styles.recentItemInfo}>

                                            <Text style={styles.recentSignal}>

                                                {point.strength} dBm

                                            </Text>

                                            <Text style={styles.recentMeta}>

                                                {point.frequency} MHz ·{" "}

                                                {new Date(point.timestamp).toLocaleTimeString()}

                                            </Text>

                                        </View>

                                        <Text style={[styles.recentQuality, { color }]}>

                                            {quality}

                                        </Text>

                                    </TouchableOpacity>

                                );

                            })

                        )}

                    </View>

                </ScrollView>

            </View>

        </View>

    );

}



const styles = StyleSheet.create({

    container: {

        flex: 1,

        backgroundColor: "#FFFFFF",

    },

    map: {
        height: "52%",
        width: "100%",
    },

    center: {

        flex: 1,

        justifyContent: "center",

        alignItems: "center",

        padding: 20,

    },

    loadingText: {

        marginTop: 12,

        marginBottom: 12,

        color: "#333333",

    },

    infoCard: {
        height: "48%",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: "#FFFFFF",
    },
    panelScroll: {
        flex: 1,
    },

    heading: {

        fontSize: 20,

        fontWeight: "bold",

        color: "#111827",

    },

    subtitle: {

        marginTop: 4,

        marginBottom: 12,

        color: "#666666",

    },

    button: {

        backgroundColor: "#1769FF",

        padding: 14,

        borderRadius: 10,

        alignItems: "center",

    },

    disabledButton: {

        opacity: 0.6,

    },

    buttonText: {

        color: "#FFFFFF",

        fontWeight: "bold",

    },

    backButton: {

        alignSelf: "flex-start",

        paddingVertical: 8,

        paddingHorizontal: 4,

        marginBottom: 8,

    },

    backButtonText: {

        color: "#1769FF",

        fontWeight: "600",

    },

    legend: {

        textAlign: "center",

        marginTop: 12,

        color: "#333333",

    },

    signalCard: {

        backgroundColor: "#F1F5F9",

        padding: 14,

        borderRadius: 12,

        marginTop: 12,

        marginBottom: 12,

    },

    signalLabel: {

        fontSize: 12,

        fontWeight: "600",

        color: "#64748B",

    },

    signalValue: {

        fontSize: 28,

        fontWeight: "bold",

        color: "#111827",

        marginTop: 6,

    },

    signalQuality: {

        fontSize: 15,

        fontWeight: "600",

        marginTop: 4,

        color: "#334155",

    },

    summaryRow: {

        flexDirection: "row",

        gap: 8,

        marginBottom: 12,

    },

    summaryCard: {

        flex: 1,

        paddingVertical: 10,

        borderRadius: 10,

        alignItems: "center",

    },

    strongCard: {

        backgroundColor: "#E0F2E8",

    },

    mediumCard: {

        backgroundColor: "#FEF3C7",

    },

    weakCard: {

        backgroundColor: "#FEE2E2",

    },

    summaryCount: {

        fontSize: 22,

        fontWeight: "bold",

    },

    summaryLabel: {

        fontSize: 12,

        fontWeight: "600",

        marginTop: 2,

    },

    recentSection: {

        marginTop: 16,

    },

    recentTitle: {

        fontSize: 17,

        fontWeight: "700",

        color: "#111827",

        marginBottom: 10,

    },

    emptyText: {

        color: "#64748B",

        paddingVertical: 12,

    },

    recentItem: {

        flexDirection: "row",

        alignItems: "center",

        justifyContent: "space-between",

        paddingVertical: 12,

        paddingHorizontal: 12,

        marginBottom: 8,

        backgroundColor: "#F8FAFC",

        borderRadius: 10,

        borderWidth: 1,

        borderColor: "#E2E8F0",

    },

    selectedRecentItem: {
        borderColor: "#1769FF",
        borderWidth: 2,
        backgroundColor: "#EFF6FF",
    },
    recentItemInfo: {

        flex: 1,

    },

    recentSignal: {

        fontSize: 16,

        fontWeight: "700",

        color: "#111827",

    },

    recentMeta: {

        fontSize: 12,

        color: "#64748B",

        marginTop: 4,

    },

    recentQuality: {

        fontSize: 13,

        fontWeight: "700",

        marginLeft: 8,

    },

});
