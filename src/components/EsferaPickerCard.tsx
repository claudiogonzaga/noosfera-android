// A ESFERA do tema espacial: três desenhos, vivos, para escolher com um toque
// (pedido de 16/11/2026). A escolha vale na hora, no cabeçalho e na aba.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card } from './Card';
import { EsferaNeural } from './Simbolo';
import { colors, radius, spacing, typography } from '../theme';
import { ESFERAS, trocarEsfera, useTipoEsfera } from '../theme/esfera';

export function EsferaPickerCard() {
  const atual = useTipoEsfera();
  const naTela = useIsFocused();
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>ESFERA</Text>
      <Text style={styles.hint}>O símbolo da Areté no tema espacial. Toque para escolher.</Text>
      <View style={styles.row}>
        {ESFERAS.map((e) => {
          const on = e.value === atual;
          return (
            <Pressable
              key={e.value}
              onPress={() => trocarEsfera(e.value)}
              style={[styles.item, on && styles.itemOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${e.label}: ${e.hint}`}
            >
              <EsferaNeural size={84} tipo={e.value} animated={naTela} />
              <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {e.label}
              </Text>
              <Text style={styles.sub} numberOfLines={3}>
                {e.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.accent.gold },
  hint: { ...typography.small, color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemOn: { borderColor: colors.accent.gold, borderWidth: 2 },
  name: { ...typography.small, fontFamily: typography.label.fontFamily, color: colors.text.primary, marginTop: spacing.xs, fontSize: 13 },
  nameOn: { color: colors.accent.gold },
  sub: { ...typography.small, fontSize: 11, lineHeight: 14, color: colors.text.tertiary, textAlign: 'center', marginTop: 2 },
});
