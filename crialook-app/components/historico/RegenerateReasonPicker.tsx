/**
 * RegenerateReasonPicker — D-11 (Phase 02 quality-loop).
 *
 * Bottom sheet that asks the lojista why she's regenerating a campaign.
 * Selection is sent as `{reason}` to POST /api/campaign/[id]/regenerate
 * (the FREE reason-capture path per Phase 01 D-03), closing the data gap
 * that left the alerting signal web-only.
 *
 * 5 PT-BR labels map 1:1 to the backend `VALID_REGENERATE_REASONS` enum.
 * Display labels (UI text) are PT-BR; submitted values are the english
 * snake_case enum keys — DO NOT conflate them.
 *
 * Library choice: `@gorhom/bottom-sheet` (already in deps, see C-03 in
 * 02-CONTEXT.md). Mirrors the BottomSheetModal + BottomSheetBackdrop
 * pattern from `components/ModelBottomSheet.tsx`. Snap point is a single
 * 50% slot — no panning required, content is short.
 *
 * Android-only per memory `crialook-app é Android-only` (D-14): no
 * Platform.OS branches, no iOS-specific props.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { tokens, rounded } from '@/lib/theme/tokens';
import type { RegenerateReason } from '@/lib/api';

export interface RegenerateReasonPickerProps {
  /** When true, the sheet presents itself; when false, it dismisses. */
  visible: boolean;
  /** Called with the backend enum key (NOT the PT-BR label). */
  onSelect: (reason: RegenerateReason) => void;
  /** Called when the user taps Cancelar or dismisses via the backdrop. */
  onCancel: () => void;
}

// PT-BR display labels are locked per CONTEXT.md `<specifics>`. The keys are
// the canonical backend enum (VALID_REGENERATE_REASONS in
// campanha-ia/src/lib/db/index.ts:272-286). Order is the order specified
// in the plan; shape is fixed pe FontAwesome icon names that ship in
// @expo/vector-icons today.
type ReasonRow = {
  key: RegenerateReason;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
};

const REASONS: ReasonRow[] = [
  { key: 'face_wrong', label: 'Rosto errado', icon: 'user-times' },
  { key: 'garment_wrong', label: 'Peça errada', icon: 'tag' },
  { key: 'copy_wrong', label: 'Texto ruim', icon: 'pencil' },
  { key: 'pose_wrong', label: 'Pose errada', icon: 'arrows' },
  { key: 'other', label: 'Outro motivo', icon: 'ellipsis-h' },
];

// Single 50% snap — content is short, no need to let the user drag higher.
// Backdrop tap calls onCancel via pressBehavior="close" + onDismiss handler.
const SNAP_POINTS: string[] = ['50%'];

export function RegenerateReasonPicker({
  visible,
  onSelect,
  onCancel,
}: RegenerateReasonPickerProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const sheetRef = useRef<BottomSheetModal>(null);

  // Drive present/dismiss from the `visible` prop. Ref is stable across
  // renders so the imperative call is fire-and-forget.
  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Sheet onDismiss: covers backdrop tap + drag-to-dismiss. Whenever the
  // user closes WITHOUT a selection, surface as cancel so historico's
  // pickerCampaignId state can clear. If we omit this, dismissing via
  // backdrop leaves the parent state pinned to the last campaign id and
  // re-opens the sheet on next render.
  const handleDismiss = useCallback(() => {
    if (visible) {
      onCancel();
    }
  }, [visible, onCancel]);

  const handleSelect = useCallback(
    (key: RegenerateReason) => {
      onSelect(key);
    },
    [onSelect],
  );

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      { paddingBottom: tokens.spacing.xxl + insets.bottom },
    ],
    [insets.bottom],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={containerStyle}>
        <Text
          style={[styles.title, { color: colors.text }]}
          accessibilityRole="header"
        >
          Por que essa precisa melhorar?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Vai ajudar a IA a aprender — e essa próxima sai gratuita.
        </Text>

        <View style={styles.rows}>
          {REASONS.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => handleSelect(r.key)}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              testID={`regenerate-reason-${r.key}`}
              android_ripple={{ color: 'rgba(217,70,239,0.10)' }}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <FontAwesome name={r.icon} size={16} color={colors.text} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {r.label}
              </Text>
            </Pressable>
          ))}

          {/* Cancel row — visually distinct via brand error color, mirrors the
              destructive-row convention used by ConfirmSheet's danger CTA. */}
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            testID="regenerate-reason-cancel"
            android_ripple={{ color: 'rgba(239,68,68,0.10)' }}
            style={[styles.row, styles.cancelRow, { borderColor: colors.border }]}
          >
            <FontAwesome name="times" size={16} color={Colors.brand.error} />
            <Text style={[styles.rowLabel, { color: Colors.brand.error }]}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.fontSize.xxl,
    fontFamily: 'Inter_700Bold',
    fontWeight: tokens.fontWeight.bold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  rows: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    ...rounded(tokens.radii.md),
  },
  cancelRow: {
    marginTop: tokens.spacing.sm,
  },
  rowLabel: {
    fontSize: tokens.fontSize.base,
    fontWeight: tokens.fontWeight.semibold,
  },
});
