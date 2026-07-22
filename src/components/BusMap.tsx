/**
 * Geographic tracking view. Renders the route polyline, every stop, the child's
 * stop, and the live bus marker on a real map.
 *
 * The bus marker tweens smoothly between position updates (AnimatedRegion) and
 * the camera can follow the bus. It consumes the same BusPosition the schematic
 * does, so it stays in sync with the rest of the app and will work unchanged
 * once positions come from real GPS.
 *
 * NOTE: react-native-maps needs a development build to render fully on Android
 * (Google Maps requires an API key configured in app.json) and on iOS outside
 * Expo Go. The route schematic (RouteProgress) remains the dependency-free
 * fallback. See docs/PLAN.md.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, {
  AnimatedRegion,
  Marker,
  MarkerAnimated,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';

import { BusPosition, LatLng, Route } from '@/models/types';
import { colors } from '@/theme/theme';

interface Props {
  route: Route;
  position: BusPosition;
  childStopIndex: number;
}

const ANIM_MS = 900; // slightly under the 1s simulator tick, so motion is fluid

export function BusMap({ route, position, childStopIndex }: Props) {
  const mapRef = useRef<MapView>(null);
  const [follow, setFollow] = useState(true);

  const coords = useMemo<LatLng[]>(
    () => route.stops.map((s) => s.location),
    [route],
  );
  const initialRegion = useMemo(() => boundsRegion(coords), [coords]);

  // Animated coordinate for the bus marker; created once and updated in place.
  const busCoord = useRef(
    new AnimatedRegion({
      latitude: position.location.latitude,
      longitude: position.location.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  const { latitude, longitude } = position.location;

  useEffect(() => {
    busCoord
      .timing({
        // AnimatedRegion.timing animates the coordinate fields directly; the
        // library's types also demand Animated's generic config keys, so the
        // config is loosened here.
        latitude,
        longitude,
        duration: ANIM_MS,
        useNativeDriver: false,
        latitudeDelta: 0,
        longitudeDelta: 0,
      } as unknown as Parameters<typeof busCoord.timing>[0])
      .start();

    if (follow) {
      mapRef.current?.animateCamera(
        { center: { latitude, longitude } },
        { duration: ANIM_MS },
      );
    }
    // busCoord is a stable ref; re-run only when the target coordinate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, follow]);

  function recenter() {
    setFollow(true);
    mapRef.current?.animateCamera(
      { center: { latitude, longitude } },
      { duration: ANIM_MS },
    );
  }

  function fitRoute() {
    setFollow(false);
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onPanDrag={() => setFollow(false)}
      >
        <Polyline
          coordinates={coords}
          strokeColor={colors.primary}
          strokeWidth={4}
        />

        {route.stops.map((stop, i) => {
          const isChildStop = i === childStopIndex;
          return (
            <Marker
              key={stop.id}
              coordinate={stop.location}
              title={stop.name}
              description={
                isChildStop ? 'Your stop' : `Scheduled ${stop.scheduledTime}`
              }
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.stopDot,
                  isChildStop ? styles.childStopDot : styles.plainStopDot,
                ]}
              >
                {isChildStop && (
                  <Ionicons name="location" size={12} color={colors.onPrimary} />
                )}
              </View>
            </Marker>
          );
        })}

        <MarkerAnimated
          coordinate={busCoord as unknown as LatLng}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View style={styles.busMarker}>
            <Ionicons name="bus" size={16} color={colors.onPrimary} />
          </View>
        </MarkerAnimated>
      </MapView>

      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, follow && styles.controlBtnActive]}
          onPress={recenter}
        >
          <Ionicons
            name="navigate"
            size={16}
            color={follow ? colors.onPrimary : colors.primary}
          />
          <Text
            style={[
              styles.controlText,
              { color: follow ? colors.onPrimary : colors.primary },
            ]}
          >
            Follow bus
          </Text>
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={fitRoute}>
          <Ionicons name="expand" size={16} color={colors.primary} />
          <Text style={[styles.controlText, { color: colors.primary }]}>
            Whole route
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A region that comfortably frames all of the route's coordinates. */
function boundsRegion(coords: LatLng[]): Region {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 1.5;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * pad, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * pad, 0.01),
  };
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  stopDot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  plainStopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  childStopDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  busMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  controls: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  controlText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
