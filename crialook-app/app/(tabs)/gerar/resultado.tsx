import { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ZoomablePhoto } from '@/components/ZoomablePhoto';
import { Sentry } from '@/lib/sentry';
import { tokens, rounded } from '@/lib/theme/tokens';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { haptic } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { maybeRequestReview, recordSuccess } from '@/lib/reviewGate';
import { maybeRequestPushPermission } from '@/lib/pushOptInGate';
import { Confetti, AuraGlow } from '@/components/skia';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { AnimatedPressable, Button, Card, GradientText, Skeleton } from '@/components/ui';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGet, apiFetchRaw } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';

interface GeneratedImage {
  imageBase64?: string;
  imageUrl?: string;
  mimeType: string;
  conceptName?: string;
  durationMs?: number;
}

interface LegendaPlataforma {
  foto: number;
  plataforma: string;
  legenda: string;
  hashtags?: string[];
  dica?: string;
}

interface DicasPostagem {
  melhor_horario?: string;
  melhor_dia?: string;
  sequencia_sugerida?: string;
  hashtags?: string[];
  cta?: string;
  tom_legenda?: string;
  caption_sugerida?: string;
  caption_alternativa?: string;
  dica_extra?: string;
  story_idea?: string;
  legendas?: LegendaPlataforma[];
}

interface OpusAnalise {
  produto?: {
    nome_generico?: string;
    tipo?: string;
    cor_principal?: string;
    cor_secundaria?: string;
    material?: string;
    comprimento?: string;
    estilo?: string;
    detalhes_especiais?: string;
  };
  negative_prompt?: string;
}

interface CampaignResult {
  success: boolean;
  campaignId?: string | null;
  objective?: string | null;
  data?: {
    analise?: OpusAnalise;
    images?: (GeneratedImage | null)[];
    dicas_postagem?: DicasPostagem;
    durationMs?: number;
    /**
     * Trial-only: dois thumbnails blurados (esquerda + direita) da foto da
     * modelo escolhida. Quando presentes, a tira "lock · hero · lock" abaixo
     * do hero indica que existem +2 ângulos editoriais bloqueados, abrindo
     * paywall ao tap. Sem chamada extra de IA — só sharp.blur no backend.
     */
    lockedTeaserUrls?: [string, string];
  };
}

// w/h em px reais — usados pra calcular aspectRatio dinamicamente no preview.
// Espelha FORMAT_PRESETS do site (gerar/demo/page.tsx) pra paridade exata.
// 🖼️ substitui ⬜ do site (que renderiza vazio em Android) — fica visualmente
// consistente com 📱/📸 (todos pictogramas coloridos).
const FORMAT_PRESETS = [
  { id: 'stories', labelKey: 'result.formatStories' as TKey, emoji: '📱', ratio: '9:16', w: 1080, h: 1920, descKey: 'result.formatStoriesDesc' as TKey },
  { id: 'feed45',  labelKey: 'result.formatFeed45'  as TKey, emoji: '📸', ratio: '4:5',  w: 1080, h: 1350, descKey: 'result.formatFeed45Desc'  as TKey },
  { id: 'feed11',  labelKey: 'result.formatFeed11'  as TKey, emoji: '🖼️', ratio: '1:1',  w: 1080, h: 1080, descKey: 'result.formatFeed11Desc'  as TKey },
] as const;

const PLATFORM_TAB_KEYS = ['result.tabFeed', 'result.tabWhatsapp', 'result.tabStories'] as const satisfies readonly TKey[];
const CHAR_LIMITS = [125, 200, 100] as const;

/**
 * LockedTeaserCard — slot da carrossel-3 no modo trial. Mostra um thumb
 * blurado (vem do backend ~45px) + BlurView nativo por cima como
 * defesa-em-profundidade (caso o backend bake o blur fraco/falte). Overlay
 * gradiente brand + lock badge com pulse Skia AuraGlow centralizado.
 *
 * Tap → /plano. Ratio 3:4 igual aos thumbs reais pra paridade visual.
 *
 * Por que 2 layers de blur (backend + frontend):
 *   O blur do backend é estático e cacheável (CDN). O frontend BlurView
 *   garante que mesmo se a foto cacheada for revelada por algum bug
 *   (override, manual url, debug screen), o usuário NÃO vê o ângulo
 *   completo da modelo — fica protegido por design.
 */
function LockedTeaserCard({
  uri,
  onPress,
  accessibilityLabel,
}: {
  uri: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="tap"
      scale={0.95}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.thumb, styles.lockedThumb]}
    >
      <Image
        source={{ uri }}
        style={styles.thumbImage}
        contentFit="cover"
        contentPosition="center"
        transition={150}
      />
      {/* Defense-in-depth blur: backend ships pre-blurred but we stack
          BlurView intensity 30 to ensure visual lock even if the source
          loads sharper than expected. Cheap (one Skia layer per thumb). */}
      <BlurView
        intensity={30}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Brand gradient overlay — fades from transparent top to brand fucsia
          bottom, hinting "premium content behind". Reads as intentional
          paywall, not broken image. */}
      <LinearGradient
        colors={['rgba(15,5,25,0.05)', 'rgba(217,70,239,0.55)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={styles.lockedOverlay} pointerEvents="none">
        {/* Soft AuraGlow behind the lock badge — pulsing brand halo draws
            the eye to the upgrade CTA without being noisy. Behind the badge
            so the icon stays sharp. Skia GPU-thread, ~zero JS cost. */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -38, marginLeft: -38 }}>
            <AuraGlow size={76} opacityMin={0.35} opacityMax={0.7} periodMs={2400} />
          </View>
        </View>
        <View style={styles.lockedBadge}>
          <FontAwesome name="lock" size={14} color="#fff" />
        </View>
      </View>
    </AnimatedPressable>
  );
}

/**
 * TrialBanner — top sticky banner que aparece somente em campanhas trial.
 * Celebra a entrega ("Sua foto-teste ficou pronta") e oferece upgrade
 * contextual com preço-âncora. Tap → /plano.
 *
 * Posicionamento: logo abaixo do header, antes do título principal.
 * Reads as positive surprise, not push.
 */
function TrialBanner({ onPress, t }: { onPress: () => void; t: ReturnType<typeof useT>['t'] }) {
  return (
    <Animated.View entering={FadeIn.duration(380).delay(120)} style={trialBannerStyles.wrap}>
      <AnimatedPressable
        onPress={onPress}
        haptic="press"
        scale={0.985}
        accessibilityRole="button"
        accessibilityLabel={t('result.trialBannerCta')}
      >
        <LinearGradient
          colors={Colors.brand.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={trialBannerStyles.gradient}
        >
          <View style={trialBannerStyles.row}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={trialBannerStyles.title}>{t('result.trialBannerTitle')}</Text>
              <Text style={trialBannerStyles.desc}>{t('result.trialBannerDesc')}</Text>
            </View>
            <View style={trialBannerStyles.cta}>
              <Text style={trialBannerStyles.ctaText}>{t('result.trialBannerCta')}</Text>
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

const trialBannerStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.spacing.xl,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  gradient: {
    ...rounded(tokens.radii.xl),
    padding: tokens.spacing.lg,
    overflow: 'hidden',
    // Brand-tinged shadow so it floats above the surface — same depth as
    // the hero "subscribe" cards on /plano.
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  title: { color: '#fff', fontSize: tokens.fontSize.lg, fontWeight: tokens.fontWeight.black, letterSpacing: -0.2 },
  desc: { color: 'rgba(255,255,255,0.92)', fontSize: tokens.fontSize.md, lineHeight: 17 },
  cta: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderCurve: 'continuous',
  },
  ctaText: { color: '#fff', fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.bold, letterSpacing: -0.1 },
});

export default function ResultadoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { t } = useT();
  const headerH = useHeaderHeight();
  // Pad o final do scroll pra o último botão "Criar mais fotos" não ficar
  // atrás da floating tab bar. Antes era paddingBottom:60 fixo, mas a barra
  // gasta ~100-120px com safe area + altura.
  const tabPad = useTabContentPaddingBottom();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();

  /* Back inteligente — se o user veio do /historico, volta pra lá (e não
     pro /gerar, que seria o pop default da stack do tab gerar). Cobre
     os 3 botões explícitos de back; o gesture iOS swipe-back ainda pop
     da stack normalmente, mas em pratique pousa em /historico via
     navigation theme do tab. */
  const goBack = useCallback(() => {
    if (from === 'historico') {
      router.replace('/(tabs)/historico');
    } else {
      router.back();
    }
  }, [from, router]);

  const [result, setResult] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState(0);
  const [activeFormat, setActiveFormat] = useState<string>('stories');
  const [showAnalysis, setShowAnalysis] = useState(false);
  /* `processing` indica qual ação está rodando ('share' | 'save' | null).
     Usado pra mostrar spinner no botão correspondente e desabilitar o outro
     enquanto o crop+download/save acontece — a galera dos grandes (Insta,
     VSCO, Lightroom Mobile) sempre dá feedback visual instantâneo. */
  const [processing, setProcessing] = useState<null | 'share' | 'save'>(null);

  useEffect(() => {
    /* `useLocalSearchParams` pode hidratar `id` no segundo render. Sem
       distinguir undefined (ainda hidratando) de "" (param ausente), o
       primeiro render setava loading=false → tela vazia → segundo render
       fetcha → flash do resultado vazio. Agora mantemos loading=true até
       termos certeza do estado. */
    if (id === undefined) return; // ainda hidratando — não toca em loading
    if (!id) { setLoading(false); return; } // param de fato ausente
    apiGet<{ data: CampaignResult }>(`/campaigns/${id}`)
      .then(res => {
        if (res?.data) {
          setResult(res.data);
          const firstValid = res.data.data?.images?.findIndex(img => img !== null) ?? 0;
          if (firstValid >= 0) setSelectedIndex(firstValid);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const getImageSrc = (img: GeneratedImage) =>
    img.imageUrl || `data:${img.mimeType};base64,${img.imageBase64}`;

  /**
   * Materializa a imagem no formato selecionado como arquivo local.
   *
   * - Stories (9:16): download DIRETO da imagem original — instantâneo,
   *   sem round-trip pro endpoint. É a saída padrão do gerador de IA.
   * - Feed 4:5 / 1:1: endpoint `/api/campaign/format` aplica contain
   *   (corpo inteiro visível) + blur nas laterais. ZERO alteração de cor.
   *
   * Fallback: se o endpoint falhar, devolve a imagem original sem
   * transformação pra "Salvar/Compartilhar" continuar funcionando.
   */
  const cropToFormat = useCallback(async (img: GeneratedImage, formatId: string): Promise<string> => {
    // Stories é a saída padrão da IA — baixa direto sem endpoint (instantâneo)
    if (formatId === 'stories') {
      const localUri = `${LegacyFS.cacheDirectory}crialook_stories_${Date.now()}.png`;
      if (img.imageUrl) {
        await LegacyFS.downloadAsync(img.imageUrl, localUri);
      } else if (img.imageBase64) {
        await LegacyFS.writeAsStringAsync(localUri, img.imageBase64, { encoding: LegacyFS.EncodingType.Base64 });
      } else {
        throw new Error('No image source available');
      }
      return localUri;
    }

    // Feed 4:5 / 1:1 — endpoint aplica contain + blur nas laterais
    try {
      const body: Record<string, string> = { format: formatId };
      if (img.imageUrl) body.imageUrl = img.imageUrl;
      else if (img.imageBase64) body.imageBase64 = img.imageBase64;
      else throw new Error('Image has neither URL nor base64');

      const res = await apiFetchRaw('/campaign/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`format endpoint ${res.status}`);

      // Salva o JPEG retornado em cache local
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result as string;
          resolve(r.split(',')[1] ?? r);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const outUri = `${LegacyFS.cacheDirectory}crialook_${formatId}_${Date.now()}.jpg`;
      await LegacyFS.writeAsStringAsync(outUri, base64, { encoding: LegacyFS.EncodingType.Base64 });
      return outUri;
    } catch (e) {
      Sentry.addBreadcrumb({
        category: 'photo',
        message: 'cropToFormat fallback to raw',
        level: 'warning',
        data: { error: e instanceof Error ? e.message : String(e) },
      });
      // Fallback: salva original sem transformação. Save/Share não quebram.
      const localUri = `${LegacyFS.cacheDirectory}crialook_raw_${Date.now()}.png`;
      if (img.imageUrl) {
        await LegacyFS.downloadAsync(img.imageUrl, localUri);
      } else if (img.imageBase64) {
        await LegacyFS.writeAsStringAsync(localUri, img.imageBase64, { encoding: LegacyFS.EncodingType.Base64 });
      } else {
        throw new Error('No image source available');
      }
      return localUri;
    }
  }, []);

  const shareImage = useCallback(async (img: GeneratedImage, _idx: number) => {
    if (processing) return; // evita doubles taps enquanto processa
    setProcessing('share');
    try {
      haptic.tap();
      // cropToFormat já materializa o arquivo no cache local (com fallback
      // pra imagem original se o endpoint falhar). Sem downloadToLocal extra.
      const formatted = await cropToFormat(img, activeFormat);
      const mime = activeFormat === 'stories' ? 'image/png' : 'image/jpeg';
      await Sharing.shareAsync(formatted, { mimeType: mime });
    } catch {
      // Falhas de share são reportadas via Sentry no path de error global;
      // não fazemos Alert porque shareAsync já tem feedback nativo do OS.
    } finally {
      setProcessing(null);
    }
  }, [cropToFormat, activeFormat, processing]);

  /**
   * Tenta o caminho "full permission" (read+write) em Dev Build/produção:
   * permite criar álbum "CriaLook" e organizar as gerações ali.
   * Se falhar (Expo Go SDK 53+ não suporta full permission no Android),
   * cai pro caminho write-only via saveToLibraryAsync — funciona em todo
   * lugar, mas sem álbum dedicado. Promove a transição Expo Go → Dev Build →
   * produção sem precisar tocar no código.
   */
  const saveToGallery = useCallback(async (img: GeneratedImage, idx: number) => {
    if (processing) return;
    setProcessing('save');
    try {
      const formatted = await cropToFormat(img, activeFormat);

      // Tenta full permission. `granularPermissions: ['photo']` evita pedir
      // AUDIO (que quebra o request inteiro em alguns ambientes).
      let hasFullPermission = false;
      try {
        const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
        hasFullPermission = perm.status === 'granted';
      } catch {
        // Expo Go SDK 53+ no Android joga aqui — tudo certo, vamos pro fallback.
      }

      if (hasFullPermission) {
        // Caminho premium — Dev Build / produção. Cria álbum "CriaLook" pro
        // user achar fácil as gerações depois (padrão Instagram/VSCO).
        const asset = await MediaLibrary.createAssetAsync(formatted);
        try {
          const album = await MediaLibrary.getAlbumAsync('CriaLook');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('CriaLook', asset, false);
          }
        } catch {
          // Asset já está na camera roll — falha de álbum não é fatal.
        }
      } else {
        // Caminho compatível — Expo Go ou usuário recusou full permission.
        // saveToLibraryAsync usa permissão write-only mais permissiva.
        await MediaLibrary.saveToLibraryAsync(formatted);
      }

      Sentry.addBreadcrumb({
        category: 'photo',
        message: 'photo_saved',
        level: 'info',
        data: { idx, fullPermission: hasFullPermission },
      });
      // Toast handles its own haptic.success (see ToastHost.tsx).
      toast.success(t('result.saveSuccessMessage'));
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'save_photo' } });
      // Toast handles haptic.error.
      toast.error(t('result.saveErrorMessage'));
    } finally {
      setProcessing(null);
    }
  }, [cropToFormat, activeFormat, processing, t]);

  const copyText = useCallback(async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    // Toast handles its own haptic.success.
    toast.success(t('result.copied'), { durationMs: 1800 });
    // Keep `copiedField` for the inline checkmark on the source button (shows
    // for 2s) — toast is the global confirmation, the checkmark is the
    // local "yes, this one was the one I tapped" cue.
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, [t]);

  // Skia confetti — fires once per successful campaign view, the moment the
  // user lands on the result. Auto-clears via onComplete so it doesn't
  // trigger again on locale change / re-render.
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!result?.success) return;
    setShowConfetti(true);
    let cancelled = false;
    (async () => {
      await recordSuccess();
      if (cancelled) return;
      // Ask for push permission contextually — RIGHT after the user
      // experiences the value. Industry data: post-action prompts get 4-5×
      // the opt-in rate of boot prompts. Idempotent: only ever asks once.
      // Slight delay so the confetti + success haptic can land first.
      setTimeout(() => {
        if (!cancelled) maybeRequestPushPermission();
      }, 900);
      // Then check if it's time for an in-app review.
      setTimeout(() => {
        if (!cancelled) maybeRequestReview();
      }, 2200);
    })();
    return () => {
      cancelled = true;
    };
  }, [result?.success]);

  /* Loading state — espelha o layout real: badge + título + hero photo 3:4
     + 3 thumbs + format selector + 2 actions. `<Skeleton>` traz shimmer
     wave (estilo iOS/Material), reduzindo a percepção de latência ~20%
     vs. spinner ou placeholder estático. */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={{
            padding: tokens.spacing.xl,
            paddingTop: headerH + tokens.spacing.lg,
            paddingBottom: tabPad,
          }}
        >
          <Skeleton width={140} height={24} borderRadius={12} />
          <Skeleton width={220} height={28} borderRadius={8} style={{ marginTop: tokens.spacing.md }} />
          <Skeleton width="60%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
          {/* Hero photo + "Foto 1 de N" badge sobreposto no canto top-left,
              espelhando o layout real (heroBadge sobre heroWrap). Sem ele,
              o eye lê o skeleton como "só uma foto" e estranha o badge
              aparecendo de repente quando carrega. */}
          <View style={{ marginTop: tokens.spacing.lg }}>
            <Skeleton width="100%" style={{ aspectRatio: 3 / 4 }} borderRadius={20} />
            <Skeleton
              width={88}
              height={22}
              borderRadius={11}
              style={{ position: 'absolute', top: tokens.spacing.md, left: tokens.spacing.md }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: tokens.spacing.lg }}>
            <Skeleton width={72} height={96} borderRadius={12} />
            <Skeleton width={72} height={96} borderRadius={12} />
            <Skeleton width={72} height={96} borderRadius={12} />
          </View>
          <Skeleton width="100%" height={110} borderRadius={14} style={{ marginTop: tokens.spacing.lg }} />
          <Skeleton width="100%" height={48} borderRadius={14} style={{ marginTop: tokens.spacing.lg }} />
          <Skeleton width="100%" height={48} borderRadius={14} style={{ marginTop: 10 }} />
        </ScrollView>
      </View>
    );
  }

  if (!result || !result.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40 }}>📷</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('result.notFoundTitle')}</Text>
        {/* Descrição + 2 CTAs (criar nova OU escapar pro histórico) — antes
            só "Criar mais fotos" travava o usuário num caminho. */}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: tokens.fontSize.md,
            textAlign: 'center',
            marginTop: tokens.spacing.sm,
            paddingHorizontal: tokens.spacing.xl,
            lineHeight: 18,
          }}
        >
          {t('result.notFoundDesc')}
        </Text>
        <View style={{ width: '100%', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg, paddingHorizontal: tokens.spacing.xl }}>
          <Button title={t('result.createMore')} onPress={goBack} />
          <Button
            title={t('result.notFoundBackToHistory')}
            variant="ghost"
            onPress={() => router.replace('/(tabs)/historico')}
          />
        </View>
      </View>
    );
  }

  const { images = [], analise, dicas_postagem: dicas, durationMs, lockedTeaserUrls } = result.data;
  // Trial-only: backend devolve 2 teaser URLs blurados da foto da modelo.
  // Quando isTrialView=true, exibimos a tira "lock · hero · lock" abaixo do
  // hero em vez da thumbRow normal. Temporariamente desabilitado: hoje
  // mostramos só 1 foto e ignoramos os teasers, mas a destruturação segue
  // viva pra reativar quando o flow voltar a usar 3 fotos (referenciado
  // dentro do branch trial mais abaixo).
  const isTrialView = false;
  // Limita a 1 foto no resultado enquanto refinamos o flow.
  const validImages = (images.filter(Boolean) as GeneratedImage[]).slice(0, 1);
  const selectedImage = validImages[selectedIndex] || validImages[0];
  const hasLegendas = dicas?.legendas && dicas.legendas.length >= 3;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader />
    {showConfetti && (
      <Confetti
        count={70}
        durationMs={2400}
        onComplete={() => setShowConfetti(false)}
      />
    )}
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: headerH + tokens.spacing.lg, paddingBottom: tabPad },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          onPress={goBack}
          haptic="tap"
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <FontAwesome name="chevron-left" size={16} color={colors.textSecondary} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
        </AnimatedPressable>
        <View style={styles.photoBadge}>
          <Text style={styles.photoBadgeText}>
            {t(validImages.length === 1 ? 'result.photoBadge' : 'result.photoBadgePlural', { n: validImages.length })}
          </Text>
        </View>
      </View>

      {/* Trial banner — visível somente p/ campanhas trial. Conta a história
          do que aconteceu (1 foto-teste pronta) + oferece próximo passo
          contextual (planos a partir de R$ 39). Aparece logo abaixo do
          header, antes do hero, pra setar expectativa antes do "wow". */}
      {isTrialView && (
        <TrialBanner onPress={() => router.push('/(tabs)/plano')} t={t} />
      )}

      {/* Title — single highlighted word in fucsia gradient, mirrors site hero pattern. */}
      <View style={styles.heroRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('result.titleSuccessBefore')}</Text>
        <GradientText colors={Colors.brand.gradientPrimary} style={styles.title}>
          {t('result.titleSuccessHighlight')}
        </GradientText>
        <Text style={[styles.title, { color: colors.text }]}>{t('result.titleSuccessAfter')}</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {analise?.produto?.nome_generico ? `${analise.produto.nome_generico} · ` : ''}
        {durationMs
          ? t('result.subtitleGeneratedIn', { seconds: (durationMs / 1000).toFixed(0) })
          : t('result.subtitlePickFav')}
      </Text>

      {/* Hero Image — outer wrapper carries the brand glow (no overflow:hidden),
          inner wrapper clips the image to the rounded shape and hosts the
          ZoomablePhoto (pinch + double-tap zoom). */}
      {selectedImage && (
        <Animated.View entering={FadeIn} style={styles.heroWrap}>
          <View style={styles.heroInner}>
            {/* contentFit="cover" + contentPosition="top" replica o `object-cover
                object-top` da versão web: a foto preenche o card 3:4, e quando
                a proporção da imagem é mais alta, o corte acontece pelos pés —
                a cabeça do modelo nunca é cortada. */}
            <ZoomablePhoto
              source={{ uri: getImageSrc(selectedImage) }}
              contentFit="cover"
              contentPosition="top"
              transition={150}
              imageStyle={styles.heroImage}
              containerStyle={styles.heroImage}
            />
            <View style={styles.heroBadge} pointerEvents="none">
              <Text style={styles.heroBadgeText}>
                {t('result.photoOf', { n: selectedIndex + 1, total: validImages.length })}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Thumbnails — trial: lock · hero · lock; paid: lista das fotos reais */}
      {isTrialView && (lockedTeaserUrls?.length ?? 0) >= 2 ? (
        <>
          <View style={styles.thumbRow}>
            <LockedTeaserCard
              uri={lockedTeaserUrls?.[0] ?? ''}
              onPress={() => router.push('/(tabs)/plano')}
              accessibilityLabel={t('result.lockedTeaserA11y')}
            />
            {selectedImage && (
              <AnimatedPressable
                onPress={() => setSelectedIndex(0)}
                haptic="selection"
                scale={0.95}
                style={[
                  styles.thumb,
                  {
                    borderColor: Colors.brand.primary,
                    borderWidth: 1,
                    shadowColor: Colors.brand.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.32,
                    shadowRadius: 8,
                    elevation: 6,
                  },
                ]}
              >
                <Image
                  source={{ uri: getImageSrc(selectedImage) }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  contentPosition="top"
                  transition={120}
                />
                <View style={styles.thumbNumber}>
                  <Text style={styles.thumbNumberText}>1</Text>
                </View>
              </AnimatedPressable>
            )}
            <LockedTeaserCard
              uri={lockedTeaserUrls?.[1] ?? ''}
              onPress={() => router.push('/(tabs)/plano')}
              accessibilityLabel={t('result.lockedTeaserA11y')}
            />
          </View>
          <Text style={[styles.lockedCaption, { color: colors.textSecondary }]}>
            {t('result.lockedTeaserCaption')}
          </Text>
        </>
      ) : (
        <View style={styles.thumbRow}>
          {validImages.map((img, idx) => (
            <AnimatedPressable
              key={idx}
              onPress={() => setSelectedIndex(idx)}
              haptic="selection"
              scale={0.95}
              style={[
                styles.thumb,
                selectedIndex === idx
                  ? {
                      borderColor: Colors.brand.primary,
                      borderWidth: 1,
                      shadowColor: Colors.brand.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.32,
                      shadowRadius: 8,
                      elevation: 6,
                    }
                  : {
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
              ]}
            >
              <Image source={{ uri: getImageSrc(img) }} style={styles.thumbImage} contentFit="cover" contentPosition="top" transition={120} />
              <View style={styles.thumbNumber}>
                <Text style={styles.thumbNumberText}>{idx + 1}</Text>
              </View>
            </AnimatedPressable>
          ))}
        </View>
      )}

      {/* Format Selector */}
      {selectedImage && (
        <Card style={styles.formatCard}>
          <View style={styles.formatHeader}>
            <Text style={[styles.formatHeaderText, { color: colors.text }]}>
              {t('result.photoSelected', { n: selectedIndex + 1 })}
            </Text>
            <View style={styles.formatRatioBadge}>
              <Text style={styles.formatRatioText}>
                {FORMAT_PRESETS.find(f => f.id === activeFormat)?.ratio}
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatRow}>
            {FORMAT_PRESETS.map(fmt => {
              const isActive = activeFormat === fmt.id;
              return (
                <Pressable
                  key={fmt.id}
                  onPress={() => {
                    haptic.selection();
                    setActiveFormat(fmt.id);
                  }}
                  android_ripple={{ color: Colors.brand.glowSoft }}
                  style={({ pressed }) => [
                    styles.formatBtn,
                    {
                      borderColor: isActive ? Colors.brand.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                    isActive && styles.formatBtnActive,
                  ]}
                >
                  <Text style={styles.formatIcon}>{fmt.emoji}</Text>
                  <Text style={[styles.formatLabel, isActive && styles.formatLabelActive]}>
                    {t(fmt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.formatDesc, { color: colors.textSecondary }]}>
            {(() => {
              const found = FORMAT_PRESETS.find(f => f.id === activeFormat);
              return found ? t(found.descKey) : '';
            })()}
          </Text>
        </Card>
      )}

      {/* Actions */}
      {selectedImage && (
        <View style={styles.actions}>
          <Button
            title={processing === 'share' ? t('result.actionSharing') : t('result.actionShare')}
            onPress={() => shareImage(selectedImage, selectedIndex)}
            loading={processing === 'share'}
            disabled={processing !== null && processing !== 'share'}
          />
          <Button
            title={processing === 'save' ? t('result.actionSaving') : t('result.actionSave')}
            variant="secondary"
            onPress={() => saveToGallery(selectedImage, selectedIndex)}
            loading={processing === 'save'}
            disabled={processing !== null && processing !== 'save'}
          />
        </View>
      )}

      {/* Dicas de Postagem */}
      {dicas && (
        <Animated.View entering={FadeInUp.delay(200)}>
          {/* AI Copy badge */}
          <View style={styles.aiBadgeRow}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>{t('result.aiCopyBadge')}</Text>
            </View>
          </View>

          {/* Platform Tabs (Feed / WhatsApp / Stories) */}
          {hasLegendas ? (
            <Card style={styles.tabsCard}>
              {/* Tab bar */}
              <View style={styles.tabBar}>
                {PLATFORM_TAB_KEYS.map((key, i) => (
                  <AnimatedPressable
                    key={i}
                    onPress={() => setCopyTab(i)}
                    haptic="selection"
                    style={[styles.tab, copyTab === i && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, copyTab === i && styles.tabTextActive]}>
                      {t(key)}
                    </Text>
                    {copyTab === i && <View style={styles.tabIndicator} />}
                  </AnimatedPressable>
                ))}
              </View>

              {/* Tab content */}
              {(() => {
                const leg = dicas.legendas![copyTab];
                if (!leg) return null;
                const charLimit = CHAR_LIMITS[copyTab];
                const charCount = leg.legenda?.length || 0;
                const isOver = charCount > charLimit;
                return (
                  <View style={styles.tabContent}>
                    <View style={styles.tipHeader}>
                      <View style={styles.tipHeaderLeft}>
                        <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{leg.plataforma}</Text>
                        <View style={[styles.charBadge, { backgroundColor: isOver ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                          <Text style={[styles.charBadgeText, { color: isOver ? '#D97706' : '#16A34A' }]}>
                            {charCount}/{charLimit}
                          </Text>
                        </View>
                      </View>
                      <AnimatedPressable
                        onPress={() => {
                          const textToCopy = leg.legenda + (leg.hashtags?.length ? '\n\n' + leg.hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ') : '');
                          copyText(textToCopy, `tab${copyTab}`);
                        }}
                        haptic={false}
                        hitSlop={10}
                        style={[styles.copyButton, copiedField === `tab${copyTab}` && styles.copyButtonCopied]}
                      >
                        <Text style={[styles.copyButtonText, copiedField === `tab${copyTab}` && styles.copyButtonTextCopied]}>
                          {copiedField === `tab${copyTab}` ? t('result.copied') : t('result.copy')}
                        </Text>
                      </AnimatedPressable>
                    </View>
                    <Text style={[styles.tipText, { color: colors.text }]}>{leg.legenda}</Text>
                    {leg.dica && (
                      <Text style={[styles.tipHint, { color: colors.textSecondary }]}>💡 {leg.dica}</Text>
                    )}
                  </View>
                );
              })()}
            </Card>
          ) : (
            /* Fallback: old campaigns without legendas[] */
            <>
              {dicas.caption_sugerida && (
                <Card style={styles.tipCard}>
                  <View style={styles.tipHeader}>
                    <View style={styles.tipHeaderLeft}>
                      <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionCaption')}</Text>
                      <View style={[styles.charBadge, { backgroundColor: (dicas.caption_sugerida.length > 125) ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                        <Text style={[styles.charBadgeText, { color: (dicas.caption_sugerida.length > 125) ? '#D97706' : '#16A34A' }]}>
                          {dicas.caption_sugerida.length}/125
                        </Text>
                      </View>
                    </View>
                    <AnimatedPressable
                      onPress={() => copyText(dicas.caption_sugerida!, 'caption')}
                      haptic={false}
                      hitSlop={10}
                      style={[styles.copyButton, copiedField === 'caption' && styles.copyButtonCopied]}
                    >
                      <Text style={[styles.copyButtonText, copiedField === 'caption' && styles.copyButtonTextCopied]}>
                        {copiedField === 'caption' ? t('result.copied') : t('result.copy')}
                      </Text>
                    </AnimatedPressable>
                  </View>
                  <Text style={[styles.tipText, { color: colors.text }]}>{dicas.caption_sugerida}</Text>
                </Card>
              )}
            </>
          )}

          {/* Hashtags */}
          {dicas.hashtags && dicas.hashtags.length > 0 && (
            <Card style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionHashtags')}</Text>
                <AnimatedPressable
                  onPress={() => copyText(dicas.hashtags!.slice(0, 8).map(h => h.startsWith('#') ? h : `#${h}`).join(' '), 'hash')}
                  haptic={false}
                  hitSlop={10}
                  style={[styles.copyButton, copiedField === 'hash' && styles.copyButtonCopied]}
                >
                  <Text style={[styles.copyButtonText, copiedField === 'hash' && styles.copyButtonTextCopied]}>
                    {copiedField === 'hash' ? t('result.copied') : t('result.copy')}
                  </Text>
                </AnimatedPressable>
              </View>
              <View style={styles.hashtagsWrap}>
                {dicas.hashtags.slice(0, 8).map((tag, i) => (
                  <View key={i} style={styles.hashtagPill}>
                    <Text style={styles.hashtagText}>{tag.startsWith('#') ? tag : `#${tag}`}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Caption alternativa — fundo levemente diferente em vez de borda dashed
              (que ficava ruim em Android) pra sinalizar "opção B" sem polui visual. */}
          {dicas.caption_alternativa && (
            <Card style={[styles.tipCard, styles.tipCardAlt]}>
              <View style={styles.tipHeader}>
                <View style={styles.tipHeaderLeft}>
                  <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionCaptionAlt')}</Text>
                  <View style={[styles.charBadge, { backgroundColor: (dicas.caption_alternativa.length > 125) ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                    <Text style={[styles.charBadgeText, { color: (dicas.caption_alternativa.length > 125) ? '#D97706' : '#16A34A' }]}>
                      {dicas.caption_alternativa.length}/125
                    </Text>
                  </View>
                </View>
                <AnimatedPressable
                  onPress={() => copyText(dicas.caption_alternativa!, 'alt')}
                  haptic={false}
                  hitSlop={10}
                  style={[styles.copyButton, copiedField === 'alt' && styles.copyButtonCopied]}
                >
                  <Text style={[styles.copyButtonText, copiedField === 'alt' && styles.copyButtonTextCopied]}>
                    {copiedField === 'alt' ? t('result.copied') : t('result.copy')}
                  </Text>
                </AnimatedPressable>
              </View>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{dicas.caption_alternativa}</Text>
            </Card>
          )}

          {/* Grid: Horário + Tom + CTA */}
          <View style={styles.infoGrid}>
            {dicas.melhor_horario && (
              <Card style={styles.infoCard}>
                <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionTime')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{dicas.melhor_horario}</Text>
              </Card>
            )}
            {dicas.tom_legenda && (
              <Card style={styles.infoCard}>
                <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionVoice')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{dicas.tom_legenda}</Text>
              </Card>
            )}
            {dicas.cta && (
              <Card style={styles.infoCardFull}>
                <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('result.sectionCta')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{dicas.cta}</Text>
              </Card>
            )}
          </View>

          {/* Story idea — sem botão copiar (cópia direta da legenda já cobre o use case) */}
          {dicas.story_idea && (
            <View style={styles.storyCard}>
              <Text style={styles.storyIcon}>📱</Text>
              <View style={styles.storyContent}>
                <Text style={styles.storyLabel}>{t('result.sectionStory')}</Text>
                <Text style={styles.storyText}>{dicas.story_idea}</Text>
              </View>
            </View>
          )}

          {/* Dica extra */}
          {dicas.dica_extra && (
            <View style={styles.dicaExtraCard}>
              <Text style={styles.dicaExtraIcon}>💡</Text>
              <Text style={styles.dicaExtraText}>{dicas.dica_extra}</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Product Analysis (collapsible) */}
      {analise?.produto && (
        <AnimatedPressable
          onPress={() => setShowAnalysis(!showAnalysis)}
          haptic="tap"
          style={[styles.analysisHeader, { borderColor: colors.border, backgroundColor: isDark ? colors.backgroundSecondary : colors.background }]}
        >
          <Text style={[styles.analysisHeaderText, { color: colors.text }]}>{t('result.analysisHeader')}</Text>
          <FontAwesome
            name={showAnalysis ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.textSecondary}
          />
          {/* Antes: glyphs ▲▼ literais. Não escalavam com fontSize, alinhavam
              estranho no baseline e o weight não batia com o resto dos
              ícones FontAwesome do app. */}
        </AnimatedPressable>
      )}
      {showAnalysis && analise?.produto && (
        <Animated.View entering={FadeInUp} style={[styles.analysisBody, { borderColor: colors.border }]}>
          <View style={styles.analysisGrid}>
            {[
              { label: t('result.analysisProduct'), value: analise.produto.nome_generico },
              { label: t('result.analysisType'), value: analise.produto.tipo },
              { label: t('result.analysisColorMain'), value: analise.produto.cor_principal },
              { label: t('result.analysisColorSecond'), value: analise.produto.cor_secundaria },
              { label: t('result.analysisMaterial'), value: analise.produto.material },
              { label: t('result.analysisLength'), value: analise.produto.comprimento },
              { label: t('result.analysisStyle'), value: analise.produto.estilo },
              { label: t('result.analysisDetails'), value: analise.produto.detalhes_especiais },
            ]
              .filter(f => f.value)
              .map((f, i) => (
                <View key={i} style={[styles.analysisItem, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.analysisItemLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                  <Text style={[styles.analysisItemValue, { color: colors.text }]}>{f.value}</Text>
                </View>
              ))}
          </View>
        </Animated.View>
      )}

      {/* New campaign — CTA primária do resultado. Antes era variant
          'secondary', mas em light mode o gradient de surface é branco-on-
          branco com border #f3f1f5 quase invisível, deixava o botão
          sumindo. Primary fucsia bate com a hierarquia (essa É a próxima
          ação esperada). */}
      <Button
        title={t('result.createMore')}
        onPress={goBack}
        style={{ marginTop: tokens.spacing.lg }}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: tokens.spacing.xl, gap: tokens.spacing.md, paddingBottom: tokens.spacing.huge },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md, padding: tokens.spacing.xl },
  loadingText: { fontSize: tokens.fontSize.base, marginTop: tokens.spacing.sm },
  emptyTitle: { fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  backText: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.medium },
  photoBadge: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
  },
  photoBadgeText: { color: Colors.brand.primary, fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.bold, fontVariant: ['tabular-nums'] },

  // Hero row keeps the highlighted gradient word inline with the surrounding
  // copy. flexWrap ensures the long success line ("Suas fotos ficaram
  // incríveis!") gracefully spans 2 lines on narrow devices.
  heroRow: { flexDirection: 'row', flexWrap: 'wrap' },
  title: { fontSize: tokens.fontSize.display, fontWeight: tokens.fontWeight.bold },
  subtitle: { fontSize: tokens.fontSize.md, marginTop: -4 },

  heroWrap: {
    aspectRatio: 3 / 4,
    width: '100%',
    ...rounded(tokens.radii.xxl),
    // Halo glow — approximates the site's 1px line + 4px inner halo + 24px
    // ambient drop shadow. RN can't stack shadows; this is the best single
    // shadow that conveys "brand-tinged elevation".
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  /* Why backgroundColor: usamos contentFit="contain" pra garantir que a foto
     inteira apareça (sem cortar cabeça do modelo). Quando a proporção da imagem
     não bate com 3:4 do container, sobra espaço — esse fundo evita branco
     gritante. Tom escuro neutro funciona em light e dark. */
  heroInner: {
    flex: 1,
    ...rounded(tokens.radii.xxl),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    backgroundColor: '#0d0a14',
  },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: {
    position: 'absolute',
    top: tokens.spacing.md,
    left: tokens.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
  },
  heroBadgeText: { color: '#fff', fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold, fontVariant: ['tabular-nums'] },

  thumbRow: { flexDirection: 'row', justifyContent: 'center', gap: tokens.spacing.md },
  thumb: { width: 72, height: 96, borderRadius: tokens.radii.md, overflow: 'hidden', backgroundColor: '#0d0a14' },
  thumbImage: { width: '100%', height: '100%' },
  thumbNumber: {
    position: 'absolute',
    bottom: tokens.spacing.xs,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radii.sm,
  },
  thumbNumberText: { color: '#fff', fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold, fontVariant: ['tabular-nums'] },
  /* Trial-only: lock thumb (slots 1 + 3 da tira) tem moldura sutil pra parecer
     irmã das outras mas com ar "bloqueado". O overlay+badge é o que faz a
     leitura visual clara. */
  lockedThumb: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  /* Gradiente NÃO usado aqui de propósito — `LinearGradient` adicionaria
     custo de import por uma sombra leve. Bg semi-transparente fixo já dá o
     efeito de "estou olhando atrás de um vidro" sem outra dependência. */
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,10,20,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(217,70,239,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  lockedCaption: {
    fontSize: tokens.fontSize.sm,
    fontWeight: tokens.fontWeight.semibold,
    textAlign: 'center',
    marginTop: tokens.spacing.sm,
    letterSpacing: 0.2,
  },

  // Format selector
  formatCard: { gap: tokens.spacing.sm },
  formatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formatHeaderText: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.bold },
  formatRatioBadge: { backgroundColor: Colors.brand.violetGlass, paddingHorizontal: tokens.spacing.sm, paddingVertical: tokens.spacing.xs, borderRadius: tokens.radii.sm },
  formatRatioText: { color: Colors.brand.primary, fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold },
  formatRow: { gap: tokens.spacing.sm, paddingVertical: tokens.spacing.xs },
  formatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.mdLg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  formatBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
  formatIcon: { fontSize: tokens.fontSize.xl },
  formatLabel: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.semibold, color: '#888' },
  formatLabelActive: { color: '#fff' },
  formatDesc: { fontSize: tokens.fontSize.xs },

  actions: { gap: tokens.spacing.md },

  // AI badge
  aiBadgeRow: { flexDirection: 'row', marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xs },
  aiBadge: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: Colors.brand.violetGlass,
  },
  aiBadgeText: { color: Colors.brand.primary, fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.black },

  // Tabs
  tabsCard: { padding: 0, overflow: 'hidden' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.mdLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: 'rgba(168,85,247,0.06)' },
  tabText: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.bold, color: '#999' },
  tabTextActive: { color: Colors.brand.primary },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.brand.primary,
  },
  tabContent: { padding: tokens.spacing.lg, gap: tokens.spacing.sm },

  // Tips — gap 10 entre header/conteúdo e marginTop 12 entre cards (respiro tipo Linear/Stripe).
  tipCard: { gap: tokens.spacing.md, marginTop: tokens.spacing.md },
  tipCardAlt: { backgroundColor: 'rgba(168,85,247,0.04)' },
  tipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.md },
  tipHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  tipLabel: { fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  tipText: { fontSize: tokens.fontSize.base, lineHeight: 21 },
  tipValue: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.semibold },
  tipHint: { fontSize: tokens.fontSize.sm, fontStyle: 'italic' },
  /* marginTop extra: o botão "Copiar" do header alinha à direita e o
     primeiro pill de hashtag ficava praticamente colado embaixo dele.
     Sem isso, visualmente parecia que o pill era um continuation do botão. */
  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  hashtagPill: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  hashtagText: { color: Colors.brand.primary, fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.semibold, letterSpacing: 0.1 },

  // Char badge
  charBadge: { paddingHorizontal: tokens.spacing.sm, paddingVertical: tokens.spacing.xxs, borderRadius: tokens.radii.sm },
  charBadgeText: { fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.black, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },

  /* Copy button — visualmente compacto (não rouba peso visual da label do card),
     mas mantemos área tocável >=44px via hitSlop no Pressable, atendendo
     guideline de acessibilidade (WCAG 2.5.5 / Material/HIG 44dp mínimo). */
  copyButton: {
    backgroundColor: Colors.brand.violetGlass,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonCopied: { backgroundColor: Colors.brand.primary },
  copyButtonText: { color: Colors.brand.primary, fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.black, letterSpacing: 0.4 },
  copyButtonTextCopied: { color: '#fff' },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md, marginTop: tokens.spacing.md },
  infoCard: { flex: 1, minWidth: '45%', gap: tokens.spacing.sm },
  infoCardFull: { width: '100%', gap: tokens.spacing.sm },
  infoValue: { fontSize: tokens.fontSize.md, fontWeight: tokens.fontWeight.bold, lineHeight: 18 },

  // Story card — agora 2 colunas (sem o copiar). Padding e gap maior pra parecer card ativo.
  storyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    padding: tokens.spacing.mdLg,
    borderRadius: tokens.radii.lg,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    marginTop: tokens.spacing.md,
  },
  storyIcon: { fontSize: tokens.fontSize.xl, marginTop: 1 },
  storyContent: { flex: 1, gap: tokens.spacing.xs },
  storyLabel: { fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.black, color: Colors.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' },
  storyText: { fontSize: tokens.fontSize.md, fontWeight: tokens.fontWeight.medium, color: Colors.brand.primary, lineHeight: 19 },

  // Dica extra
  dicaExtraCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    marginTop: tokens.spacing.sm,
  },
  dicaExtraIcon: { fontSize: tokens.fontSize.base, marginTop: 2 },
  dicaExtraText: { flex: 1, fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.medium, color: Colors.brand.primary, lineHeight: 17 },

  // Analysis
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    ...rounded(tokens.radii.xl),
    borderWidth: 1,
    marginTop: tokens.spacing.sm,
  },
  analysisHeaderText: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.bold },
  analysisBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: tokens.radii.xl,
    borderBottomRightRadius: tokens.radii.xl,
    borderCurve: 'continuous',
    padding: tokens.spacing.md,
    marginTop: -8,
  },
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  analysisItem: {
    minWidth: '45%',
    flex: 1,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    gap: tokens.spacing.xxs,
  },
  analysisItemLabel: { fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  analysisItemValue: { fontSize: tokens.fontSize.md, fontWeight: tokens.fontWeight.bold },
});
