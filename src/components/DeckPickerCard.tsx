// O BARALHO DAS MENSAGENS, logo no alto das Configurações (pedido de 16/11/2026).
//
// Antes, trocar de baralho pedia Configurações → Sons e Vozes → Biblioteca →
// Baralhos de áudio, e cada baralho era uma chave independente. Aqui a escolha é
// de um toque: tocar num baralho passa a usar SÓ ele (desliga os outros, de
// áudio e de texto) e os alertas são reagendados na hora. O anterior fica
// guardado, com um atalho para voltar.
//
// Combinar vários baralhos continua possível nas telas de gerenciar; se houver
// mais de um ligado, todos aparecem marcados e o cartão avisa.

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card } from './Card';
import { colors, radius, spacing, typography } from '../theme';
import {
  listAudioDecks,
  listInspirationPacks,
  setAudioDeckEnabled,
  setInspirationPackEnabled,
} from '../services/database';
import { scheduleInspirationNotifications } from '../services/inspiration';

type Kind = 'audio' | 'texto';
interface Item {
  key: string; // "audio:3" | "texto:1"
  kind: Kind;
  id: number;
  name: string;
  sub: string;
  enabled: boolean;
}

const PREV_KEY = 'baralho_anterior';

export function DeckPickerCard() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Item[] | null>(null);
  const [prev, setPrev] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [audio, packs] = await Promise.all([listAudioDecks(), listInspirationPacks()]);
      setItems([
        ...audio.map<Item>((d) => ({
          key: `audio:${d.id}`,
          kind: 'audio',
          id: d.id,
          name: d.name,
          sub: `áudio · ${d.activeCount} ${d.activeCount === 1 ? 'trecho' : 'trechos'} · ${d.playMode === 'sequence' ? 'na sequência' : 'aleatório'}`,
          enabled: d.enabled,
        })),
        ...packs.map<Item>((p) => ({
          key: `texto:${p.id}`,
          kind: 'texto',
          id: p.id,
          name: p.name,
          sub: `texto · ${p.cardCount} ${p.cardCount === 1 ? 'frase' : 'frases'}`,
          enabled: p.enabled,
        })),
      ]);
    } catch (err) {
      console.warn('DeckPickerCard:', err);
      setItems([]);
    }
    try {
      const raw = await AsyncStorage.getItem(PREV_KEY);
      setPrev(raw ? (JSON.parse(raw) as string[]) : null);
    } catch {
      setPrev(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Liga exatamente estes baralhos e desliga os demais; guarda o conjunto anterior. */
  const apply = async (keys: string[]) => {
    if (!items || busy) return;
    const want = new Set(keys);
    const before = items.filter((i) => i.enabled).map((i) => i.key);
    if (before.length === want.size && before.every((k) => want.has(k))) return;
    setBusy(true);
    setItems(items.map((i) => ({ ...i, enabled: want.has(i.key) })));
    try {
      for (const i of items) {
        const on = want.has(i.key);
        if (on === i.enabled) continue;
        if (i.kind === 'audio') await setAudioDeckEnabled(i.id, on);
        else await setInspirationPackEnabled(i.id, on);
      }
      if (before.length > 0) {
        await AsyncStorage.setItem(PREV_KEY, JSON.stringify(before));
        setPrev(before);
      }
      void scheduleInspirationNotifications().catch(() => {});
    } catch (err) {
      console.warn('DeckPickerCard.apply:', err);
    } finally {
      setBusy(false);
      void load();
    }
  };

  if (items === null) return null;
  const on = items.filter((i) => i.enabled);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const prevValid = (prev ?? []).filter((k) => byKey.has(k));
  const prevDiffers =
    prevValid.length > 0 && !(prevValid.length === on.length && prevValid.every((k) => byKey.get(k)!.enabled));
  const prevName = prevValid.length === 1 ? byKey.get(prevValid[0])!.name : `${prevValid.length} baralhos`;

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>BARALHO DAS MENSAGENS</Text>
      <Text style={styles.hint}>
        {items.length === 0
          ? 'Nenhum baralho ainda. Importe um de áudio ou de texto.'
          : on.length === 0
            ? 'Nenhum baralho em uso: as mensagens de inspiração não tocam. Toque num para usar.'
            : on.length === 1
              ? 'Toque em outro baralho para trocar. Passa a valer no próximo alerta.'
              : `${on.length} baralhos combinados. Toque num para usar só ele.`}
      </Text>

      {items.map((i) => (
        <Pressable
          key={i.key}
          onPress={() => void apply([i.key])}
          disabled={busy}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          accessibilityRole="radio"
          accessibilityState={{ selected: i.enabled }}
          accessibilityLabel={`${i.name}, ${i.sub}`}
        >
          <View style={[styles.radio, i.enabled && styles.radioOn]}>{i.enabled && <View style={styles.dot} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, i.enabled && styles.nameOn]} numberOfLines={2}>
              {i.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {i.sub}
            </Text>
          </View>
        </Pressable>
      ))}

      {prevDiffers && (
        <Pressable onPress={() => void apply(prevValid)} disabled={busy} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText} numberOfLines={2}>
            ↩ Voltar ao anterior: {prevName}
          </Text>
        </Pressable>
      )}

      <View style={styles.links}>
        <Pressable onPress={() => navigation.navigate('AudioDecks')} hitSlop={6} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Gerenciar áudio →</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('InspirationLibrary')} hitSlop={6} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Gerenciar texto →</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.accent.gold },
  hint: { ...typography.small, color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.xs, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent.gold },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent.gold },
  name: { ...typography.bodyMedium, color: colors.text.primary },
  nameOn: { fontFamily: typography.label.fontFamily },
  sub: { ...typography.small, color: colors.text.tertiary },
  back: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backText: { ...typography.small, fontFamily: typography.label.fontFamily, color: colors.accent.gold },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.md, marginTop: spacing.sm },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.small, fontFamily: typography.label.fontFamily, color: colors.accent.gold },
});
