/**
 * A vertical schematic of the route: every stop as a node, the bus rendered at
 * its interpolated position between nodes, and the child's stop highlighted.
 *
 * This renders with plain React Native views so it runs in Expo Go with no
 * native map dependency. The geographic map (react-native-maps) is a planned
 * enhancement layered on top of the same BusPosition data — see docs/PLAN.md.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BusPosition, Route } from '@/models/types';
import { colors, radius, spacing } from '@/theme/theme';

interface Props {
  route: Route;
  position: BusPosition;
  childStopIndex: number;
}

const ROW_HEIGHT = 64;

export function RouteProgress({ route, position, childStopIndex }: Props) {
  const progressIndex = position.currentStopIndex + position.progressToNext;

  return (
    <View style={styles.container}>
      {route.stops.map((stop, i) => {
        const isChildStop = i === childStopIndex;
        const reached = progressIndex >= i - 0.001;
        const isLast = i === route.stops.length - 1;

        // Bus sits on the segment between stop i and i+1.
        const busOnThisSegment =
          position.currentStopIndex === i && !isLast && position.status !== 'completed';

        return (
          <View key={stop.id} style={styles.row}>
            <View style={styles.railColumn}>
              <Node reached={reached} isChildStop={isChildStop} />
              {!isLast && (
                <View style={styles.segment}>
                  <View
                    style={[
                      styles.segmentFill,
                      {
                        height: busOnThisSegment
                          ? `${position.progressToNext * 100}%`
                          : reached && progressIndex >= i + 1
                            ? '100%'
                            : '0%',
                      },
                    ]}
                  />
                  {busOnThisSegment && (
                    <View
                      style={[
                        styles.bus,
                        { top: `${position.progressToNext * 100}%` },
                      ]}
                    >
                      <Ionicons name="bus" size={16} color={colors.onPrimary} />
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.labelColumn}>
              <Text
                style={[
                  styles.stopName,
                  isChildStop && styles.childStopName,
                  reached && styles.reachedStopName,
                ]}
                numberOfLines={1}
              >
                {stop.name}
              </Text>
              <Text style={styles.scheduled}>
                {stop.scheduledTime}
                {isChildStop ? '  ·  Your stop' : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Node({
  reached,
  isChildStop,
}: {
  reached: boolean;
  isChildStop: boolean;
}) {
  if (isChildStop) {
    return (
      <View style={[styles.node, styles.childNode]}>
        <Ionicons name="location" size={16} color={colors.onPrimary} />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.node,
        reached ? styles.nodeReached : styles.nodePending,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    minHeight: ROW_HEIGHT,
  },
  railColumn: {
    width: 32,
    alignItems: 'center',
  },
  node: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeReached: {
    backgroundColor: colors.primary,
  },
  nodePending: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  childNode: {
    backgroundColor: colors.accent,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  segment: {
    flex: 1,
    width: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'visible',
    marginVertical: 2,
  },
  segmentFill: {
    width: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  bus: {
    position: 'absolute',
    left: -12,
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    zIndex: 3,
  },
  labelColumn: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingTop: 0,
    justifyContent: 'flex-start',
  },
  stopName: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  reachedStopName: {
    color: colors.text,
  },
  childStopName: {
    color: colors.accent,
    fontWeight: '800',
  },
  scheduled: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
