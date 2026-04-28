import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useState } from 'react';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, onFocus, onBlur, ...props }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.tabIconDefault}
        onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            borderColor: error ? Colors.brand.error : (isFocused ? Colors.brand.primary : colors.border),
          },
          isFocused && styles.inputFocused,
          style,
        ]}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  inputFocused: {
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  error: { fontSize: 12, color: Colors.brand.error, fontFamily: 'Inter_400Regular' },
});
