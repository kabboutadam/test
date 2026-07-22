/**
 * Geographic tracking view. Renders the route polyline, every stop, the child's
 * stop, and the live bus marker on a real map.
 *
 * Consumes the same BusPosition the schematic does, so it stays in sync with the
 * rest of the app and will work unchanged once positions come from real GPS.
 *
 * NOTE: react-native-maps needs a development build to render fully on Android
 * (Google Maps requires an API key configured via the config plugin in app.json)
 * and on iOS outside Expo Go. The route schematic (RouteProgress) remains the
 * dependency-free fallback and the default view. See docs/PLAN.md.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
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

export function BusMap({ route, position, childStopIndex }: Props) {
  const coords = useMemo<LatLng[]>(
    () => route.stops.map((s) => s.location),
    [route],
  );
  const initialRegion = useMemo(() => boundsRegion(coords), [coords]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
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

        <Marker
          coordinate={position.location}
          title={route.name}
          description={`${position.speedKmh} km/h`}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View style={styles.busMarker}>
            <Ionicons name="bus" size={16} color={colors.onPrimary} />
          </View>
        </Marker>
      </MapView>
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
});
