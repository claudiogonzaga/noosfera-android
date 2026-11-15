// A aba Bluesky do Escudo (v1.133): o feed que o Mac filtra e pontua, lido do
// Drive (services/bluesky.ts). Cada card tem 👍 quero mais, 👎 não quero e ➡️
// pular; ao tocar, o card some na hora e o rótulo vai para o Mac uns segundos
// depois. Fica ao lado das abas YouTube e X do feed, com o mesmo cabeçalho.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { ScreenContainer } from '../components/ScreenContainer';
import { NotSignedInError } from '../services/auth';
import {
  cachedFeed,
  fetchFeed,
  flushLabels,
  hiddenUris,
  lastSendError,
  markPost,
  noteLabel,
  onLabelsChange,
  parseGenerated,
  pendingCount,
  shortWhen,
  staleWarning,
  visiblePosts,
  type BskyFeed,
  type BskyPost,
  type BskyVote,
} from '../services/bluesky';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { LOGO_ESCUDO } from '../theme/logo';

type Props = NativeStackScreenProps<RootStackParamList, 'Bluesky'>;

const VOTES: { v: BskyVote; label: string; a11y: string }[] = [
  { v: 1, label: '👍', a11y: 'Quero mais posts assim' },
  { v: 0, label: '👎', a11y: 'Não quero posts assim' },
  { v: -1, label: '➡️ pular', a11y: 'Pular este post' },
];

function PostCard({ post, onVote }: { post: BskyPost; onVote: (v: BskyVote) => void }) {
  const nota = noteLabel(post.nota);
  return (
    <View style={styles.card}>
      <View style={styles.byline}>
        <Text style={styles.name} numberOfLines={1}>
          {post.nome || post.handle}
        </Text>
        {post.handle ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{post.handle}
          </Text>
        ) : null}
      </View>
      {post.quando ? <Text style={styles.when}>{post.quando}</Text> : null}
      <Text style={styles.text} selectable>
        {post.texto}
      </Text>
      <View style={styles.metaRow}>
        {post.link ? (
          <Pressable
            onPress={() => void Linking.openURL(post.link).catch(() => undefined)}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.open}>abrir no Bluesky</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {nota ? <Text style={styles.note}>{nota}</Text> : null}
      </View>
      <View style={styles.votes}>
        {VOTES.map((b) => (
          <Pressable
            key={b.v}
            onPress={() => onVote(b.v)}
            accessibilityRole="button"
            accessibilityLabel={b.a11y}
            style={({ pressed }) => [styles.vote, pressed && styles.votePressed]}
          >
            <Text style={styles.voteText}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function BlueskyScreen({ navigation }: Props) {
  const [feed, setFeed] = useState<BskyFeed | null>(() => cachedFeed());
  const [hidden, setHidden] = useState<Set<string>>(() => hiddenUris());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ text: string; toSettings?: boolean } | null>(null);
  const [pending, setPending] = useState(() => pendingCount());
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(
    () =>
      onLabelsChange(() => {
        setPending(pendingCount());
        setSendError(lastSendError());
      }),
    [],
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    // o que ficou na fila de uma vez sem rede vai junto
    void flushLabels();
    try {
      const f = await fetchFeed();
      setFeed(f);
      setError(null);
    } catch (e) {
      if (e instanceof NotSignedInError) {
        setError({ text: 'Conecte a sua conta Google para ler o feed do Bluesky.', toSettings: true });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError({ text: `Não consegui ler o feed no Drive: ${msg}` });
      }
    } finally {
      setHidden(hiddenUris());
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const vote = useCallback((post: BskyPost, v: BskyVote) => {
    void Haptics.selectionAsync();
    setHidden((h) => new Set(h).add(post.uri));
    markPost(post.uri, v);
    setPending(pendingCount());
  }, []);

  const posts = useMemo(() => (feed ? visiblePosts(feed, hidden) : []), [feed, hidden]);

  const gerado = parseGenerated(feed?.gerado_em);
  const stale = staleWarning(feed?.gerado_em ?? null);
  const metaLine = [feed?.status, gerado ? `gerado às ${shortWhen(gerado)}` : null].filter(Boolean).join(' · ');

  const header = (
    <View style={styles.header}>
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <Image source={LOGO_ESCUDO} style={styles.logo} />
          <Text style={styles.appName}>Escudo</Text>
        </View>
      </View>

      <View style={styles.sources}>
        {(['youtube', 'x'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => navigation.navigate('Feed', { source: s })}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            style={styles.sourceTab}
          >
            <Text style={styles.sourceText}>{s === 'youtube' ? 'YouTube' : 'X'}</Text>
          </Pressable>
        ))}
        <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.sourceTab, styles.sourceTabOn]}>
          <Text style={[styles.sourceText, styles.sourceTextOn]}>Bluesky</Text>
        </View>
      </View>

      {metaLine ? <Text style={styles.metaLine}>{metaLine}</Text> : null}
      {stale ? <Text style={styles.stale}>{stale}</Text> : null}
      {pending > 0 && sendError ? (
        <Text style={styles.metaLine}>
          {pending} {pending === 1 ? 'marcação espera' : 'marcações esperam'} envio · tento de novo ao atualizar
        </Text>
      ) : null}
      {error ? (
        <Pressable
          onPress={error.toSettings ? () => navigation.navigate('Settings') : undefined}
          style={styles.banner}
        >
          <Text style={styles.bannerText}>
            {error.text}
            {error.toSettings ? '  → Configurações' : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.uri}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {refreshing && !feed ? 'Lendo o feed…' : 'Nenhum post novo. O feed é gerado no Mac.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} onVote={(v) => vote(item, v)} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={colors.accent.gold}
            colors={[colors.accent.gold]}
            progressBackgroundColor={colors.bg.gradientEnd}
          />
        }
        contentContainerStyle={styles.list}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // os mesmos recuos e o mesmo cabeçalho do feed (FeedScreen)
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.xl + spacing.xs, paddingBottom: spacing.md },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 22 },
  appName: { ...typography.title, color: colors.text.primary },
  sources: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sourceTab: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  sourceTabOn: { borderBottomColor: colors.text.primary },
  sourceText: { ...typography.small, fontFamily: 'Inter_600SemiBold', color: colors.text.tertiary },
  sourceTextOn: { color: colors.text.primary },
  metaLine: { ...typography.small, fontSize: 11, color: colors.text.tertiary, marginTop: spacing.sm },
  stale: { ...typography.small, fontSize: 12, color: colors.text.secondary, marginTop: spacing.xs },
  banner: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.bg.surface,
  },
  bannerText: { ...typography.small, color: colors.text.secondary },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  byline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  name: { ...typography.bodyMedium, fontFamily: 'Inter_600SemiBold', color: colors.text.primary, flexShrink: 1 },
  handle: { ...typography.small, color: colors.text.secondary, flexShrink: 1 },
  when: { ...typography.small, fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  text: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.text.primary, marginTop: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  open: { ...typography.small, fontFamily: 'Inter_600SemiBold', color: colors.accent.gold, textDecorationLine: 'underline' },
  note: { ...typography.small, fontSize: 11, color: colors.text.tertiary },
  votes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  vote: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.surface,
  },
  votePressed: { backgroundColor: colors.bg.surfaceStrong },
  voteText: { ...typography.bodyMedium, fontSize: 16, color: colors.text.primary },
  empty: { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyText: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
});
