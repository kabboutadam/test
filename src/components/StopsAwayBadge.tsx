import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { arrivalLabelKey } from '@/i18n/strings';
import { RouteSession } from '@/models/types';
import { ArrivalInfo } from '@/services/stopsAway';
import { colors, radius, spacing } from '@/theme/theme';

const phaseColor: Record<ArrivalInfo['phase'], string> = {
  arriving: colors.success,
  approaching: colors.warning,
  incoming: colors.primary,
  picked_up: colors.textMuted,
  not_started: colors.textMuted,
};

export function StopsAwayBadge({
  arrival,
  session = 'morning',
}: {
  arrival: ArrivalInfo;
  session?: RouteSession;
}) {
  const { t } = useI18n();
  const color = phaseColor[arrival.phase];
  const showBig =
    arrival.phase === 'incoming' || arrival.phase === 'approaching';
  const { key, vars } = arrivalLabelKey(arrival, session);

  return (
    <View style={[styles.container, { borderColor: color }]}>
      {showBig ? (
        <View style={styles.bigRow}>
          <Text style={[styles.bigNumber, { color }]}>{arrival.stopsAway}</Text>
          <View>
            <Text style={[styles.bigLabel, { color }]}>
              {arrival.stopsAway === 1 ? t('badge.stopAway') : t('badge.stopsAway')}
            </Text>
            {arrival.etaMinutes > 0 && (
              <Text style={styles.eta}>~{arrival.etaMinutes} {t('common.min')}</Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={[styles.statusText, { color }]}>{t(key, vars)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
  },
  bigLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  eta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
