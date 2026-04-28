/**
 * CreateModelSheet
 *
 * A native-feeling fullscreen sheet for creating a new virtual model. The
 * previous flow toggled `showForm` and re-rendered the whole tab — visually
 * indistinguishable from the list state. Replacing it with a 95%-snap
 * `BottomSheetModal` matches the pattern users see in Instagram, Linear,
 * Notion and X: heavyweight forms slide up from the bottom over the parent
 * screen, the parent stays mounted in the background, and the user dismisses
 * by dragging down or tapping the dim backdrop.
 *
 * Design choices:
 *   - Single 95% snap point — using ['65%','95%'] for a form felt fragile
 *     because partial-height confused users into thinking the form wasn't
 *     scrollable. One snap, full sheet.
 *   - The handle indicator + an explicit "✕" stay visible at the top so the
 *     dismiss affordance never gets lost behind keyboard avoidance.
 *   - All form state lives in the parent (`useCreateModelForm`) so callers
 *     can reset / pre-populate without prop-drilling 8 setters.
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  AnimatedPressable,
  Button,
  GradientText,
  Input,
} from '@/components/ui';
import { haptic } from '@/lib/haptics';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

export interface CreateModelSheetRef {
  present: () => void;
  dismiss: () => void;
}

export type Gender = 'feminino' | 'masculino';

export interface CreateModelFormState {
  gender: Gender;
  setGender: (g: Gender) => void;
  skin: string;
  setSkin: (s: string) => void;
  hairTexture: string;
  setHairTexture: (s: string) => void;
  hairLength: string;
  setHairLength: (s: string) => void;
  hairColor: string;
  setHairColor: (s: string) => void;
  body: string;
  setBody: (s: string) => void;
  name: string;
  setName: (s: string) => void;
  /** When user flips gender we want sensible defaults for length/body. */
  resetForGender: (g: Gender) => void;
}

interface Props {
  state: CreateModelFormState;
  creating: boolean;
  onSubmit: () => void;
  /** Called when the sheet finishes its dismiss animation (index === -1). */
  onDismissed?: () => void;
}

const SKIN_TONES = [
  { value: 'branca', labelKey: 'model.skinLight' as const, color: '#F5D0B5' },
  { value: 'morena_clara', labelKey: 'model.skinTanLight' as const, color: '#D4A574' },
  { value: 'morena', labelKey: 'model.skinTan' as const, color: '#A67B5B' },
  { value: 'negra', labelKey: 'model.skinDark' as const, color: '#6B4226' },
];

const HAIR_TEXTURES = [
  { value: 'liso', labelKey: 'model.hairStraight' as const },
  { value: 'ondulado', labelKey: 'model.hairWavy' as const },
  { value: 'cacheado', labelKey: 'model.hairCurly' as const },
  { value: 'crespo', labelKey: 'model.hairCoiled' as const },
];

const HAIR_LENGTHS_FEM = [
  { value: 'curto', labelKey: 'model.lengthShort' as const },
  { value: 'medio', labelKey: 'model.lengthMedium' as const },
  { value: 'longo', labelKey: 'model.lengthLong' as const },
];

const HAIR_LENGTHS_MASC = [
  { value: 'raspado', labelKey: 'model.lengthShaved' as const },
  { value: 'curto', labelKey: 'model.lengthShort' as const },
  { value: 'medio', labelKey: 'model.lengthMedium' as const },
];

const HAIR_COLORS = [
  { value: 'preto', labelKey: 'model.colorBlack' as const },
  { value: 'castanho', labelKey: 'model.colorBrown' as const },
  { value: 'ruivo', labelKey: 'model.colorRed' as const },
  { value: 'loiro', labelKey: 'model.colorBlonde' as const },
  { value: 'platinado', labelKey: 'model.colorPlatinum' as const },
];

const BODY_TYPES_FEM = [
  { value: 'magra', labelKey: 'model.bodySlim' as const },
  { value: 'media', labelKey: 'model.bodyStandard' as const },
  { value: 'plus_size', labelKey: 'model.bodyCurvy' as const },
];

const BODY_TYPES_MASC = [
  { value: 'atletico', labelKey: 'model.bodyAthletic' as const },
  { value: 'medio', labelKey: 'model.bodyMid' as const },
  { value: 'robusto', labelKey: 'model.bodyRobust' as const },
];

function OptionButton({
  label,
  selected,
  onPress,
  color,
  isDark,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  isDark: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={() => {
        if (!selected) haptic.selection();
        onPress();
      }}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.optionBtn,
        { borderColor: Colors[isDark ? 'dark' : 'light'].border },
        selected && {
          backgroundColor: Colors.brand.primary,
          borderColor: Colors.brand.primary,
        },
      ]}
    >
      {color ? <View style={[styles.colorDot, { backgroundColor: color }]} /> : null}
      <Text
        style={[
          styles.optionText,
          { color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280' },
          selected && { color: '#fff' },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export const CreateModelSheet = forwardRef<CreateModelSheetRef, Props>(
  function CreateModelSheet({ state, creating, onSubmit, onDismissed }, ref) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const isDark = colorScheme === 'dark';
    const { t } = useT();
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          Haptics.selectionAsync().catch(() => {});
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.55}
          pressBehavior="close"
        />
      ),
      [],
    );

    const handleChange = useCallback(
      (index: number) => {
        if (index === -1) onDismissed?.();
      },
      [onDismissed],
    );

    const hairLengths = state.gender === 'masculino' ? HAIR_LENGTHS_MASC : HAIR_LENGTHS_FEM;
    const bodyTypes = state.gender === 'masculino' ? BODY_TYPES_MASC : BODY_TYPES_FEM;

    const snapPoints = useMemo(() => ['95%'] as string[], []);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{
          backgroundColor: colors.textSecondary,
          width: 44,
          height: 5,
          borderRadius: 3,
        }}
      >
        {/* Header — title + dismiss affordance, sticky above scrollview. */}
        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <GradientText
              colors={Colors.brand.gradientPrimary}
              style={styles.titleHero}
            >
              {state.gender === 'masculino'
                ? t('model.formNewMale')
                : t('model.formNewFemale')}
            </GradientText>
          </View>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}
          >
            <FontAwesome name="close" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldGender')}
          </Text>
          <View style={styles.optionRow}>
            <OptionButton
              isDark={isDark}
              label={t('model.genderFemale')}
              selected={state.gender === 'feminino'}
              onPress={() => state.resetForGender('feminino')}
            />
            <OptionButton
              isDark={isDark}
              label={t('model.genderMale')}
              selected={state.gender === 'masculino'}
              onPress={() => state.resetForGender('masculino')}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldSkin')}
          </Text>
          <View style={styles.optionRow}>
            {SKIN_TONES.map(s => (
              <OptionButton
                key={s.value}
                isDark={isDark}
                label={t(s.labelKey)}
                color={s.color}
                selected={state.skin === s.value}
                onPress={() => state.setSkin(s.value)}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldHairTexture')}
          </Text>
          <View style={styles.optionRow}>
            {HAIR_TEXTURES.map(h => (
              <OptionButton
                key={h.value}
                isDark={isDark}
                label={t(h.labelKey)}
                selected={state.hairTexture === h.value}
                onPress={() => state.setHairTexture(h.value)}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldHairLength')}
          </Text>
          <View style={styles.optionRow}>
            {hairLengths.map(h => (
              <OptionButton
                key={h.value}
                isDark={isDark}
                label={t(h.labelKey)}
                selected={state.hairLength === h.value}
                onPress={() => state.setHairLength(h.value)}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldHairColor')}
          </Text>
          <View style={styles.optionRow}>
            {HAIR_COLORS.map(h => (
              <OptionButton
                key={h.value}
                isDark={isDark}
                label={t(h.labelKey)}
                selected={state.hairColor === h.value}
                onPress={() => state.setHairColor(h.value)}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t('model.fieldBody')}
          </Text>
          <View style={styles.optionRow}>
            {bodyTypes.map(b => (
              <OptionButton
                key={b.value}
                isDark={isDark}
                label={t(b.labelKey)}
                selected={state.body === b.value}
                onPress={() => state.setBody(b.value)}
              />
            ))}
          </View>

          <Input
            label={t('model.fieldName')}
            value={state.name}
            onChangeText={state.setName}
            placeholder={t('model.namePlaceholder')}
            maxLength={20}
          />

          <View style={{ height: 4 }} />

          <Button
            title={creating ? t('model.creating') : t('model.createSubmit')}
            onPress={onSubmit}
            loading={creating}
            haptic="confirm"
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleHero: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  label: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  optionText: { fontSize: 13, fontWeight: '500' },
  colorDot: { width: 20, height: 20, borderRadius: 10 },
});
