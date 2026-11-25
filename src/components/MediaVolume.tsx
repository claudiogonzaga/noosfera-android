import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AudioScrubber } from './AudioScrubber';
import { getMediaVolume, loadMediaVolume, onMediaVolume, setMediaVolume } from '../services/mediaVolume';
import { colors, spacing, typography } from '../theme';

/**
 * Barra do volume das trilhas do app (respiração, leitura, Ioga Nidra), separado
 * do volume do celular: dá para baixar só a trilha e deixar o YouTube como está.
 */
export function MediaVolume({ style }: { style?: object }) {
  const [v, setV] = useState(getMediaVolume());
  useEffect(() => {
    void loadMediaVolume().then(setV);
    return onMediaVolume(setV);
  }, []);
  return (
    <View style={[styles.row, style]} accessibilityLabel={`Volume da trilha: ${Math.round(v * 100)}%`}>
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {v === 0 ? 'Mudo' : 'Volume'}
      </Text>
      <View style={styles.bar}>
        <AudioScrubber progress={v} onSeek={(f) => setMediaVolume(f)} />
      </View>
      <Text style={styles.pct} numberOfLines={1} maxFontSizeMultiplier={1.1}>
        {Math.round(v * 100)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.small, color: colors.text.secondary, width: 64 },
  bar: { flex: 1 },
  pct: { ...typography.small, color: colors.text.secondary, width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
