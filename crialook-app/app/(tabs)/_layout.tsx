/**
 * app/(tabs)/_layout.tsx — NativeTabs (Material 3 on Android, UIKit on iOS).
 *
 * Why we migrated off the custom Pill TabBar:
 *   The custom bar mirrored the marketing site's pill UX, which is great
 *   visual identity but reimplements behaviour the OS already does better:
 *   ripple feedback (Android), badge support, ANR-safe re-orderability,
 *   accessibility ordering, dynamic type respect, predictive-back integration.
 *   NativeTabs gives all of that for free and reads as "real Android app".
 *
 *   The site's pill identity is preserved in the *content* of the screens
 *   (gradient hero text, brand-tinged cards) — the tab bar doesn't have to
 *   carry it. Apple HIG and Material 3 both recommend the OS bottom nav
 *   stay neutral so it doesn't compete with screen content.
 *
 *   When iOS launches we get UIKit Tab Bar + iOS 26 features (search role,
 *   liquid-glass backdrop) free. The previous custom bar would have to be
 *   re-implemented per platform.
 *
 * Brand tint:
 *   `tintColor` colours the selected icon + label with our fuchsia. The
 *   ripple uses Material You by default (system_accent1) but degrades to
 *   neutral grey on devices < Android 12. We don't override the ripple so
 *   user-installed Material You themes are honoured.
 */
import { NativeTabs, Icon, Label, Badge } from 'expo-router/unstable-native-tabs';
import { useT } from '@/lib/i18n';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useNavigationLocked } from '@/lib/navigationLock';
import { useMaterialYou } from '@/hooks/useMaterialYou';
import { useUnseenHistoricoCount } from '@/lib/unseenGenerations';

/**
 * Map screen names → (Material icon, SF Symbol). NativeTabs accepts both:
 *   - `drawable` for Android (Material Symbols / vector drawable resource)
 *   - `sf` for iOS (SF Symbols)
 *
 * Material Symbols available out-of-the-box without bundling: `magic_button`,
 * `history`, `person`, `star`, `settings`. SF Symbols are present on every
 * iOS install.
 */
const ICONS = {
  gerar: { drawable: 'ic_menu_add', sf: 'wand.and.stars' },
  historico: { drawable: 'ic_menu_recent_history', sf: 'clock' },
  modelo: { drawable: 'ic_menu_myplaces', sf: 'person.crop.circle' },
  plano: { drawable: 'btn_star', sf: 'star.fill' },
  configuracoes: { drawable: 'ic_menu_preferences', sf: 'gearshape.fill' },
} as const;

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const { t } = useT();
  const { accent: materialAccent, isDynamic } = useMaterialYou();
  // Read-only subscription to the historico cache — see lib/unseenGenerations.
  // Doesn't trigger a network request from this layout.
  const unseenCount = useUnseenHistoricoCount();

  // Navigation lock: when a long-running flow runs (campaign generation),
  // hide the tab bar so the user can't navigate away mid-process. This was
  // the previous behaviour of the custom bar — preserve it here by simply
  // returning null.
  const navLocked = useNavigationLocked();
  if (navLocked) return null;

  // Tint resolution:
  //   • Android 12+ with Material You → use the OS dynamic accent
  //     (system_accent1_500). Tab bar then breathes with the user's wallpaper
  //     and feels deeply native — Pixel-class polish on supported devices.
  //   • Otherwise → brand fuchsia (primaryLight in dark for contrast).
  // Hero gradients/text on the SCREENS keep brand fuchsia regardless, so
  // identity stays consistent — only the bar adapts.
  const tintColor = isDynamic
    ? materialAccent
    : scheme === 'dark'
    ? Colors.brand.primaryLight
    : Colors.brand.primary;

  return (
    <NativeTabs
      tintColor={tintColor}
      // Background = our glass token so the bar blends with the screens'
      // surface gradient. Material picks this up; iOS uses it under blur.
      backgroundColor={colors.glass}
    >
      <NativeTabs.Trigger name="gerar">
        <Icon drawable={ICONS.gerar.drawable} sf={ICONS.gerar.sf} />
        <Label>{t('tabs.gerar')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="historico">
        <Icon drawable={ICONS.historico.drawable} sf={ICONS.historico.sf} />
        <Label>{t('tabs.historico')}</Label>
        {/* Material 3 dot/number badge — only renders when there's actually
            something new to surface. The Badge node itself manages its own
            hidden state, but conditionally mounting keeps the OS from
            rendering an empty pill on first launch. */}
        {unseenCount > 0 && <Badge>{String(unseenCount)}</Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="modelo">
        <Icon drawable={ICONS.modelo.drawable} sf={ICONS.modelo.sf} />
        <Label>{t('tabs.modelo')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="plano">
        <Icon drawable={ICONS.plano.drawable} sf={ICONS.plano.sf} />
        <Label>{t('tabs.plano')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="configuracoes">
        <Icon drawable={ICONS.configuracoes.drawable} sf={ICONS.configuracoes.sf} />
        <Label>{t('tabs.configuracoes')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
