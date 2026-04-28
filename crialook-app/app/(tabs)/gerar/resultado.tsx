import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { ZoomablePhoto } from '@/components/ZoomablePhoto';
import { Sentry } from '@/lib/sentry';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { haptic } from '@/lib/haptics';
import { maybeRequestReview, recordSuccess } from '@/lib/reviewGate';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { AnimatedPressable, Button, Card, GradientText } from '@/components/ui';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
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

export default function ResultadoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { t } = useT();
  const headerH = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();

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
    if (!id) { setLoading(false); return; }
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
    console.log('[crop] start', { formatId, hasUrl: !!img.imageUrl, hasB64: !!img.imageBase64 });

    // Stories é a saída padrão da IA — baixa direto sem endpoint (instantâneo)
    if (formatId === 'stories') {
      const localUri = `${LegacyFS.cacheDirectory}crialook_stories_${Date.now()}.png`;
      if (img.imageUrl) {
        console.log('[crop] stories direct download');
        await LegacyFS.downloadAsync(img.imageUrl, localUri);
      } else if (img.imageBase64) {
        await LegacyFS.writeAsStringAsync(localUri, img.imageBase64, { encoding: LegacyFS.EncodingType.Base64 });
      } else {
        throw new Error('No image source available');
      }
      console.log('[crop] stories OK ->', localUri);
      return localUri;
    }

    // Feed 4:5 / 1:1 — endpoint aplica contain + blur nas laterais
    try {
      const body: Record<string, string> = { format: formatId };
      if (img.imageUrl) body.imageUrl = img.imageUrl;
      else if (img.imageBase64) body.imageBase64 = img.imageBase64;
      else throw new Error('Image has neither URL nor base64');

      console.log('[crop] calling /api/campaign/format for', formatId);
      const res = await apiFetchRaw('/campaign/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log('[crop] response', res.status, res.ok);
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
      console.log('[crop] formatted OK ->', outUri);
      return outUri;
    } catch (e) {
      console.warn('[crop] fallback to raw', e instanceof Error ? e.message : String(e));
      Sentry.addBreadcrumb({
        category: 'photo',
        message: 'cropToFormat fallback to raw',
        level: 'warning',
        data: { error: e instanceof Error ? e.message : String(e) },
      });
      // Fallback: salva original sem transformação
      const localUri = `${LegacyFS.cacheDirectory}crialook_raw_${Date.now()}.png`;
      try {
        if (img.imageUrl) {
          await LegacyFS.downloadAsync(img.imageUrl, localUri);
        } else if (img.imageBase64) {
          await LegacyFS.writeAsStringAsync(localUri, img.imageBase64, { encoding: LegacyFS.EncodingType.Base64 });
        } else {
          throw new Error('No image source available');
        }
        console.log('[crop] fallback OK ->', localUri);
        return localUri;
      } catch (fallbackErr) {
        console.error('[crop] fallback FAILED', fallbackErr);
        throw fallbackErr;
      }
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
    } catch (e) {
      console.warn('[share] failed', e);
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
      console.log('[save] cropToFormat returned:', formatted);

      // Tenta full permission. `granularPermissions: ['photo']` evita pedir
      // AUDIO (que quebra o request inteiro em alguns ambientes).
      let hasFullPermission = false;
      try {
        const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
        hasFullPermission = perm.status === 'granted';
        console.log('[save] full permission:', perm.status);
      } catch (permErr) {
        // Expo Go SDK 53+ no Android joga aqui — tudo certo, vamos pro fallback.
        console.log('[save] full permission unavailable, using write-only fallback', permErr instanceof Error ? permErr.message : '');
      }

      if (hasFullPermission) {
        // Caminho premium — Dev Build / produção. Cria álbum "CriaLook" pro
        // user achar fácil as gerações depois (padrão Instagram/VSCO).
        console.log('[save] creating asset (full path)...');
        const asset = await MediaLibrary.createAssetAsync(formatted);
        try {
          const album = await MediaLibrary.getAlbumAsync('CriaLook');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('CriaLook', asset, false);
          }
          console.log('[save] saved with album OK');
        } catch (albumErr) {
          // Asset já está na camera roll — falha de álbum não é fatal.
          console.warn('[save] album op failed (non-fatal):', albumErr);
        }
      } else {
        // Caminho compatível — Expo Go ou usuário recusou full permission.
        // saveToLibraryAsync usa permissão write-only mais permissiva.
        console.log('[save] saveToLibraryAsync (write-only path)...');
        await MediaLibrary.saveToLibraryAsync(formatted);
        console.log('[save] saved write-only OK');
      }

      Sentry.addBreadcrumb({
        category: 'photo',
        message: 'photo_saved',
        level: 'info',
        data: { idx, fullPermission: hasFullPermission },
      });
      haptic.success();
      Alert.alert(t('result.saveSuccessTitle'), t('result.saveSuccessMessage'));
    } catch (e) {
      console.error('[save] FAILED', e);
      Sentry.captureException(e, { tags: { feature: 'save_photo' } });
      haptic.error();
      Alert.alert(t('common.error'), t('result.saveErrorMessage'));
    } finally {
      setProcessing(null);
    }
  }, [cropToFormat, activeFormat, processing, t]);

  const copyText = useCallback(async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    haptic.success();
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  useEffect(() => {
    if (!result?.success) return;
    let cancelled = false;
    (async () => {
      await recordSuccess();
      if (cancelled) return;
      await maybeRequestReview();
    })();
    return () => {
      cancelled = true;
    };
  }, [result?.success]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={Colors.brand.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('result.loadingCampaign')}</Text>
      </View>
    );
  }

  if (!result || !result.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40 }}>📷</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('result.notFoundTitle')}</Text>
        <Button title={t('result.createMore')} onPress={() => router.back()} />
      </View>
    );
  }

  const { images = [], analise, dicas_postagem: dicas, durationMs } = result.data;
  const validImages = images.filter(Boolean) as GeneratedImage[];
  const selectedImage = validImages[selectedIndex] || validImages[0];
  const hasLegendas = dicas?.legendas && dicas.legendas.length >= 3;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader />
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: headerH + 16 }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
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

      {/* Thumbnails */}
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
            {FORMAT_PRESETS.map(fmt => (
              <AnimatedPressable
                key={fmt.id}
                onPress={() => setActiveFormat(fmt.id)}
                haptic="selection"
                style={[
                  styles.formatBtn,
                  { borderColor: activeFormat === fmt.id ? Colors.brand.primary : colors.border },
                  activeFormat === fmt.id && styles.formatBtnActive,
                ]}
              >
                <Text style={styles.formatIcon}>{fmt.emoji}</Text>
                <Text style={[styles.formatLabel, activeFormat === fmt.id && styles.formatLabelActive]}>
                  {t(fmt.labelKey)}
                </Text>
              </AnimatedPressable>
            ))}
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
          <Text style={[styles.analysisChevron, { color: colors.textSecondary }]}>
            {showAnalysis ? '▲' : '▼'}
          </Text>
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

      {/* New campaign */}
      <Button
        title={t('result.createMore')}
        variant="secondary"
        onPress={() => router.back()}
        style={{ marginTop: 16 }}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 12, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
  photoBadge: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: { color: Colors.brand.primary, fontSize: 12, fontWeight: '700' },

  // Hero row keeps the highlighted gradient word inline with the surrounding
  // copy. flexWrap ensures the long success line ("Suas fotos ficaram
  // incríveis!") gracefully spans 2 lines on narrow devices.
  heroRow: { flexDirection: 'row', flexWrap: 'wrap' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: -4 },

  heroWrap: {
    aspectRatio: 3 / 4,
    width: '100%',
    borderRadius: 20,
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
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    backgroundColor: '#0d0a14',
  },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  thumbRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  thumb: { width: 72, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0d0a14' },
  thumbImage: { width: '100%', height: '100%' },
  thumbNumber: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  thumbNumberText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Format selector
  formatCard: { gap: 8 },
  formatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formatHeaderText: { fontSize: 14, fontWeight: '700' },
  formatRatioBadge: { backgroundColor: 'rgba(124,58,237,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  formatRatioText: { color: Colors.brand.primary, fontSize: 10, fontWeight: '700' },
  formatRow: { gap: 8, paddingVertical: 4 },
  formatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  formatBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
  formatIcon: { fontSize: 16 },
  formatLabel: { fontSize: 12, fontWeight: '600', color: '#888' },
  formatLabelActive: { color: '#fff' },
  formatDesc: { fontSize: 11 },

  actions: { gap: 10 },

  // AI badge
  aiBadgeRow: { flexDirection: 'row', marginTop: 16, marginBottom: 4 },
  aiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  aiBadgeText: { color: Colors.brand.primary, fontSize: 10, fontWeight: '800' },

  // Tabs
  tabsCard: { padding: 0, overflow: 'hidden' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.06)' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#999' },
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
  tabContent: { padding: 16, gap: 8 },

  // Tips — gap 10 entre header/conteúdo e marginTop 12 entre cards (respiro tipo Linear/Stripe).
  tipCard: { gap: 10, marginTop: 12 },
  tipCardAlt: { backgroundColor: 'rgba(124,58,237,0.04)' },
  tipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  tipHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  tipText: { fontSize: 14, lineHeight: 21 },
  tipValue: { fontSize: 14, fontWeight: '600' },
  tipHint: { fontSize: 12, fontStyle: 'italic' },
  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashtagPill: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  hashtagText: { color: Colors.brand.primary, fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },

  // Char badge
  charBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  charBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

  /* Copy button — visualmente compacto (não rouba peso visual da label do card),
     mas mantemos área tocável >=44px via hitSlop no Pressable, atendendo
     guideline de acessibilidade (WCAG 2.5.5 / Material/HIG 44dp mínimo). */
  copyButton: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonCopied: { backgroundColor: Colors.brand.primary },
  copyButtonText: { color: Colors.brand.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  copyButtonTextCopied: { color: '#fff' },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  infoCard: { flex: 1, minWidth: '45%', gap: 6 },
  infoCardFull: { width: '100%', gap: 6 },
  infoValue: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  // Story card — agora 2 colunas (sem o copiar). Padding e gap maior pra parecer card ativo.
  storyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
    marginTop: 12,
  },
  storyIcon: { fontSize: 16, marginTop: 1 },
  storyContent: { flex: 1, gap: 4 },
  storyLabel: { fontSize: 10, fontWeight: '800', color: Colors.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' },
  storyText: { fontSize: 13, fontWeight: '500', color: Colors.brand.primary, lineHeight: 19 },

  // Dica extra
  dicaExtraCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
    marginTop: 8,
  },
  dicaExtraIcon: { fontSize: 14, marginTop: 2 },
  dicaExtraText: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.brand.primary, lineHeight: 17 },

  // Analysis
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  analysisHeaderText: { fontSize: 14, fontWeight: '700' },
  analysisChevron: { fontSize: 12 },
  analysisBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 12,
    marginTop: -8,
  },
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  analysisItem: {
    minWidth: '45%',
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  analysisItemLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  analysisItemValue: { fontSize: 13, fontWeight: '700' },
});
