
import React, { useState } from "react";
import Svg, {
    Polygon,
    Rect,
    Circle,
    Defs,
    ClipPath,
    G,
} from "react-native-svg";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";

import { getWifiDetails } from "../services/wifiService";

type Props = {
    navigation: {
        goBack: () => void;
    };
};

type Point = {
    x: number;
    y: number;
};

type RoomShape =
    | "Rectangle"
    | "Square"
    | "L-shape"
    | "T-shape"
    | "U-shape";

type ShapePoint = {
    x: number;
    y: number;
};

function getShapePoints(shape: RoomShape): ShapePoint[] {
    switch (shape) {
        case "Square":
        case "Rectangle":
            return [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
            ];

        case "L-shape":
            return [
                { x: 0, y: 0 },
                { x: 0.65, y: 0 },
                { x: 0.65, y: 0.4 },
                { x: 1, y: 0.4 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
            ];

        case "T-shape":
            return [
                { x: 0.25, y: 0 },
                { x: 0.75, y: 0 },
                { x: 0.75, y: 0.35 },
                { x: 1, y: 0.35 },
                { x: 1, y: 0.65 },
                { x: 0.75, y: 0.65 },
                { x: 0.75, y: 1 },
                { x: 0.25, y: 1 },
                { x: 0.25, y: 0.65 },
                { x: 0, y: 0.65 },
                { x: 0, y: 0.35 },
                { x: 0.25, y: 0.35 },
            ];

        case "U-shape":
            return [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0.7, y: 1 },
                { x: 0.7, y: 0.3 },
                { x: 0.3, y: 0.3 },
                { x: 0.3, y: 1 },
                { x: 0, y: 1 },
            ];
    }
}

type Room = {
    name: string;
    width: number;
    length: number;
    shape: RoomShape;
    customPoints?: Point[];
};

type Reading = Point & {
    id: number;
    strength: number;
    frequency: number;
    time: string;
};

const GRID_COLUMNS = 14;
const GRID_ROWS = 18;
function pointInsidePolygon(
    point: { x: number; y: number },
    polygon: { x: number; y: number }[]
): boolean {
    let inside = false;

    for (
        let i = 0, j = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {
        const a = polygon[i];
        const b = polygon[j];

        const intersects =
            (a.y > point.y) !== (b.y > point.y) &&
            point.x <
            ((b.x - a.x) * (point.y - a.y)) /
            ((b.y - a.y) || 0.000001) +
            a.x;

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

export default function IndoorMapScreen({ navigation }: Props) {
    const [roomName, setRoomName] = useState("My Room");
    const [width, setWidth] = useState("4");
    const [length, setLength] = useState("5");
    const [roomShape, setRoomShape] = useState<RoomShape>("Rectangle");
    const [room, setRoom] = useState<Room | null>(null);

    const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
    const [tapSize, setTapSize] = useState({ width: 0, height: 0 });
    const [measuredReading, setMeasuredReading] = useState<{
        strength: number;
        frequency: number;
    } | null>(null);

    const [readings, setReadings] = useState<Reading[]>([]);
    const [measuring, setMeasuring] = useState(false);

    function createRoom() {
        const w = Number(width);
        const l = Number(length);

        if (
            !roomName.trim() ||
            !Number.isFinite(w) ||
            !Number.isFinite(l) ||
            w <= 0 ||
            l <= 0 ||
            w > 100 ||
            l > 100
        ) {
            Alert.alert(
                "Invalid room details",
                "Enter a room name and dimensions greater than 0 and no more than 100 metres."
            );
            return;
        }

        setRoom({
            name: roomName.trim(),
            width: roomShape === "Square" ? Math.min(w, l) : w,
            length: roomShape === "Square" ? Math.min(w, l) : l,
            shape: roomShape,
        });

        setSelectedPoint(null);
        setMeasuredReading(null);
        setReadings([]);
    }

    function selectPosition(x: number, y: number) {
        if (!room) return;

        const point: Point = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
        };

        // Ignore taps in the empty cut-outs of L-, T-, and U-shaped rooms.
        if (!pointInsidePolygon(point, getShapePoints(room.shape))) {
            return;
        }

        setSelectedPoint(point);
        setMeasuredReading(null);
    }

    async function measureWifi() {
        if (!room || !selectedPoint) {
            Alert.alert("Select a position", "Tap inside the room first.");
            return;
        }

        try {
            setMeasuring(true);
            const result = await getWifiDetails();

            setMeasuredReading({
                strength: result.strength,
                frequency: result.frequency,
            });
        } catch (error) {
            Alert.alert(
                "Wi-Fi measurement failed",
                error instanceof Error
                    ? error.message
                    : "Could not read Wi-Fi details. Check your Wi-Fi connection and permissions."
            );
        } finally {
            setMeasuring(false);
        }
    }

    function saveReading() {
        if (!room || !selectedPoint || !measuredReading) {
            Alert.alert(
                "No measurement",
                "Measure Wi-Fi before saving the reading."
            );
            return;
        }

        const newReading: Reading = {
            id: Date.now(),
            x: selectedPoint.x,
            y: selectedPoint.y,
            strength: measuredReading.strength,
            frequency: measuredReading.frequency,
            time: new Date().toLocaleTimeString(),
        };

        setReadings((previous) => [...previous, newReading]);
        setMeasuredReading(null);

        Alert.alert("Reading saved", "Wi-Fi reading added to your room map.");
    }

    function signalColor(strength: number) {
        if (strength >= -55) return "#16A34A";
        if (strength >= -70) return "#EAB308";
        return "#DC2626";
    }

    function signalQuality(strength: number) {
        if (strength >= -55) return "Strong";
        if (strength >= -70) return "Medium";
        return "Weak";
    }

    // Inverse-distance weighted interpolation estimates the signal
    // between actual measurement points.
    function estimateSignal(x: number, y: number): number | null {
        if (readings.length === 0) return null;

        let weightedStrength = 0;
        let totalWeight = 0;

        for (const reading of readings) {
            const dx = (x - reading.x) * (room?.width ?? 1);
            const dy = (y - reading.y) * (room?.length ?? 1);
            const distanceSquared = dx * dx + dy * dy;

            // At a measured point, use its actual reading.
            if (distanceSquared < 0.000001) {
                return reading.strength;
            }

            const weight = 1 / Math.pow(distanceSquared, 1.2);

            weightedStrength += reading.strength * weight;
            totalWeight += weight;
        }

        return totalWeight > 0
            ? weightedStrength / totalWeight
            : null;
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity
                style={styles.backButton}
                onPress={navigation.goBack}
            >
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Indoor Wi-Fi Map</Text>
            <Text style={styles.description}>
                Measure Wi-Fi at different positions and view estimated coverage.
            </Text>

            {/* Room setup */}
            <View style={styles.card}>
                <Text style={styles.label}>Room name</Text>
                <TextInput
                    value={roomName}
                    onChangeText={setRoomName}
                    placeholder="e.g. Bedroom"
                    style={styles.input}
                    maxLength={40}
                />

                <Text style={styles.label}>Width (metres)</Text>
                <TextInput
                    value={width}
                    onChangeText={setWidth}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="4"
                />

                <Text style={styles.label}>Length (metres)</Text>
                <TextInput
                    value={length}
                    onChangeText={setLength}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="5"
                />

                <Text style={styles.label}>Room shape</Text>
                <View style={styles.shapeOptions}>
                    {(["Rectangle", "Square", "L-shape", "T-shape", "U-shape"] as RoomShape[]).map((shape) => (
                        <TouchableOpacity
                            key={shape}
                            style={[styles.shapeButton, roomShape === shape && styles.shapeButtonActive]}
                            onPress={() => setRoomShape(shape)}
                        >
                            <Text style={[styles.shapeButtonText, roomShape === shape && styles.shapeButtonTextActive]}>
                                {shape}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={createRoom}
                >
                    <Text style={styles.primaryButtonText}>
                        {room ? "Update Room" : "Create Room"}
                    </Text>
                </TouchableOpacity>
            </View>

            {room && (
                <>
                    {/* Room map and heatmap */}
                    <View style={styles.card}>
                        <Text style={styles.roomTitle}>{room.name}</Text>
                        <Text style={styles.roomDetails}>
                            {room.width} m × {room.length} m ·{" "}
                            {(room.width * room.length).toFixed(2)} m²
                        </Text>

                        <Text style={styles.hint}>
                            Tap inside the room to choose a measurement position.
                        </Text>


                        <View style={styles.roomOuter}>
                            <View
                                style={[
                                    styles.roomInner,
                                    { aspectRatio: room.width / room.length },
                                ]}
                                onLayout={(event) => {
                                    const { width: w, height: h } = event.nativeEvent.layout;
                                    setTapSize({ width: w, height: h });
                                }}
                            >

                                <Svg
                                    width="100%"
                                    height="100%"
                                    viewBox="0 0 360 450"
                                    style={StyleSheet.absoluteFill}
                                >
                                    <Defs>
                                        <ClipPath id="roomShapeClip">
                                            <Polygon
                                                points={getShapePoints(room.shape)
                                                    .map((p) => `${p.x * 360},${p.y * 450}`)
                                                    .join(" ")}
                                            />
                                        </ClipPath>
                                    </Defs>

                                    {/* Room background */}
                                    <Polygon
                                        points={getShapePoints(room.shape)
                                            .map((p) => `${p.x * 360},${p.y * 450}`)
                                            .join(" ")}
                                        fill="#111923"
                                    />

                                    {/* Estimated Wi-Fi heatmap, clipped to room shape */}
                                    {readings.length > 0 && (
                                        <G clipPath="url(#roomShapeClip)">
                                            {Array.from(
                                                { length: GRID_ROWS * GRID_COLUMNS },
                                                (_, index) => {
                                                    const col = index % GRID_COLUMNS;
                                                    const row = Math.floor(index / GRID_COLUMNS);

                                                    const x = (col + 0.5) / GRID_COLUMNS;
                                                    const y = (row + 0.5) / GRID_ROWS;
                                                    const strength = estimateSignal(x, y);

                                                    if (
                                                        strength === null ||
                                                        !pointInsidePolygon({ x, y }, getShapePoints(room.shape))
                                                    ) {
                                                        return null;
                                                    }

                                                    return (
                                                        <Rect
                                                            key={index}
                                                            x={(col / GRID_COLUMNS) * 360}
                                                            y={(row / GRID_ROWS) * 450}
                                                            width={360 / GRID_COLUMNS + 1}
                                                            height={450 / GRID_ROWS + 1}
                                                            fill={signalColor(strength)}
                                                            opacity={0.42}
                                                        />
                                                    );
                                                }
                                            )}
                                        </G>
                                    )}

                                    {/* Saved measurement markers */}
                                    {readings.map((reading) => (
                                        <Circle
                                            key={reading.id}
                                            cx={reading.x * 360}
                                            cy={reading.y * 450}
                                            r={8}
                                            fill={signalColor(reading.strength)}
                                            stroke="#FFFFFF"
                                            strokeWidth={2}
                                        />
                                    ))}

                                    {/* Selected measurement position */}
                                    {selectedPoint && (
                                        <Circle
                                            cx={selectedPoint.x * 360}
                                            cy={selectedPoint.y * 450}
                                            r={9}
                                            fill="#1769FF"
                                            stroke="#FFFFFF"
                                            strokeWidth={3}
                                        />
                                    )}

                                    {/* Room outline drawn last */}
                                    <Polygon
                                        points={getShapePoints(room.shape)
                                            .map((p) => `${p.x * 360},${p.y * 450}`)
                                            .join(" ")}
                                        fill="none"
                                        stroke="#67E8F9"
                                        strokeWidth={4}
                                    />
                                </Svg>

                                <TouchableOpacity
                                    activeOpacity={1}
                                    style={styles.roomTapArea}
                                    onPress={(event) => {
                                        const { locationX, locationY } = event.nativeEvent;

                                        if (!tapSize.width || !tapSize.height) return;

                                        selectPosition(
                                            locationX / tapSize.width,
                                            locationY / tapSize.height
                                        );
                                    }}
                                />
                            </View>
                        </View>


                        {selectedPoint && (
                            <Text style={styles.selectedText}>
                                Selected position:{" "}
                                {(selectedPoint.x * room.width).toFixed(2)} m from left,{" "}
                                {(selectedPoint.y * room.length).toFixed(2)} m from top
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                (!selectedPoint || measuring) && styles.disabledButton,
                            ]}
                            onPress={measureWifi}
                            disabled={!selectedPoint || measuring}
                        >
                            {measuring ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    Measure Wi-Fi
                                </Text>
                            )}
                        </TouchableOpacity>

                        {measuredReading && (
                            <View style={styles.resultBox}>
                                <Text style={styles.resultHeading}>
                                    Current Measurement
                                </Text>

                                <Text
                                    style={[
                                        styles.signalValue,
                                        { color: signalColor(measuredReading.strength) },
                                    ]}
                                >
                                    {measuredReading.strength} dBm
                                </Text>

                                <Text style={styles.resultText}>
                                    Quality: {signalQuality(measuredReading.strength)}
                                </Text>

                                <Text style={styles.resultText}>
                                    Frequency: {measuredReading.frequency} MHz
                                </Text>

                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={saveReading}
                                >
                                    <Text style={styles.primaryButtonText}>
                                        Save Reading
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Heatmap legend */}
                        <View style={styles.legend}>
                            <Text style={styles.legendTitle}>
                                Estimated Wi-Fi coverage
                            </Text>

                            <View style={styles.legendRow}>
                                <Text style={styles.legendText}>🟢 Strong</Text>
                                <Text style={styles.legendText}>🟡 Medium</Text>
                                <Text style={styles.legendText}>🔴 Weak</Text>
                            </View>

                            <Text style={styles.disclaimer}>
                                Colors between measured points are estimates, not direct
                                measurements.
                            </Text>
                        </View>
                    </View>

                    {/* Saved measurements */}
                    <View style={styles.card}>
                        <Text style={styles.roomTitle}>
                            Saved Measurements ({readings.length})
                        </Text>

                        {readings.length === 0 ? (
                            <Text style={styles.emptyText}>
                                No readings yet. Select a position and measure Wi-Fi.
                            </Text>
                        ) : (
                            readings.map((reading, index) => (
                                <View key={reading.id} style={styles.readingItem}>
                                    <View
                                        style={[
                                            styles.readingDot,
                                            { backgroundColor: signalColor(reading.strength) },
                                        ]}
                                    />

                                    <View style={styles.readingInfo}>
                                        <Text style={styles.readingTitle}>
                                            Point {index + 1}: {reading.strength} dBm
                                        </Text>

                                        <Text style={styles.readingDetails}>
                                            {signalQuality(reading.strength)} ·{" "}
                                            {reading.frequency} MHz
                                        </Text>

                                        <Text style={styles.readingDetails}>
                                            {(reading.x * room.width).toFixed(2)} m from left,{" "}
                                            {(reading.y * room.length).toFixed(2)} m from top
                                        </Text>

                                        <Text style={styles.readingTime}>{reading.time}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0E141D",
    },
    content: {
        padding: 18,
        paddingBottom: 36,
    },
    backButton: {
        alignSelf: "flex-start",
        paddingVertical: 10,
    },
    backText: {
        color: "#67E8F9",
        fontWeight: "600",
    },
    title: {
        fontSize: 26,
        fontWeight: "800",
        color: "#FFFFFF",
        marginTop: 8,
    },
    description: {
        color: "#8B98A9",
        marginTop: 6,
        marginBottom: 20,
        lineHeight: 21,
    },
    card: {
        backgroundColor: "#151C25",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#26313D",
    },
    label: {
        fontWeight: "600",
        color: "#E6EDF5",
        marginBottom: 7,
        marginTop: 10,
    },
    input: {
        backgroundColor: "#0E141D",
        borderWidth: 1,
        borderColor: "#344252",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        color: "#FFFFFF",
        fontSize: 16,
    },
    shapeOptions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
    },
    shapeButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#344252",
        borderRadius: 10,
        backgroundColor: "#151C25",
    },
    shapeButtonActive: {
        backgroundColor: "#0E7490",
        borderColor: "#67E8F9",
    },
    shapeButtonText: {
        color: "#E6EDF5",
        fontWeight: "600",
    },
    shapeButtonTextActive: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    primaryButton: {
        marginTop: 18,
        padding: 14,
        borderRadius: 10,
        backgroundColor: "#0E7490",
        alignItems: "center",
    },
    disabledButton: {
        opacity: 0.5,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16,
        textAlign: "center",
    },
    roomTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    roomDetails: {
        marginTop: 5,
        color: "#8B98A9",
    },
    hint: {
        color: "#AAB4C3",
        marginTop: 16,
        marginBottom: 12,
        lineHeight: 20,
    },
    roomOuter: {
        alignItems: "center",
        padding: 8,
    },
    roomInner: {
        width: "100%",
        maxWidth: 360,
        alignSelf: "center",
        // The SVG draws the actual room outline. Do not draw a rectangular
        // React Native border behind L-, T-, or U-shaped rooms.
        borderWidth: 0,
        backgroundColor: "transparent",
        overflow: "hidden",
    },
    heatmap: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: "hidden",
    },
    heatCell: {
        position: "absolute",
    },
    roomTapArea: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    selectedPoint: {
        position: "absolute",
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#0E7490",
        borderWidth: 3,
        borderColor: "#FFFFFF",
        marginLeft: -9,
        marginTop: -9,
    },
    savedPoint: {
        position: "absolute",
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        marginLeft: -8,
        marginTop: -8,
    },
    selectedText: {
        color: "#67E8F9",
        fontWeight: "600",
        lineHeight: 22,
        marginTop: 8,
    },
    resultBox: {
        marginTop: 18,
        padding: 16,
        borderRadius: 12,
        backgroundColor: "#17212D",
    },
    resultHeading: {
        color: "#E6EDF5",
        fontWeight: "700",
        fontSize: 16,
    },
    signalValue: {
        fontSize: 30,
        fontWeight: "800",
        marginTop: 8,
    },
    resultText: {
        color: "#AAB4C3",
        marginTop: 5,
        fontSize: 15,
    },
    saveButton: {
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        backgroundColor: "#166534",
        alignItems: "center",
    },
    legend: {
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: "#26313D",
    },
    legendTitle: {
        color: "#E6EDF5",
        fontWeight: "700",
        marginBottom: 10,
    },
    legendRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
    },
    legendText: {
        color: "#AAB4C3",
        fontSize: 13,
    },
    disclaimer: {
        color: "#8B98A9",
        fontSize: 12,
        lineHeight: 18,
        marginTop: 10,
    },
    emptyText: {
        color: "#8B98A9",
        lineHeight: 21,
        marginTop: 12,
    },
    readingItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#26313D",
        gap: 10,
    },
    readingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 5,
    },
    readingInfo: {
        flex: 1,
    },
    readingTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    readingDetails: {
        fontSize: 13,
        color: "#8B98A9",
        marginTop: 4,
    },
    readingTime: {
        fontSize: 12,
        color: "#718096",
        marginTop: 4,
    },
});
