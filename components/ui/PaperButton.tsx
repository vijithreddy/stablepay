import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Paper } from '../../constants/PaperTheme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
};

export default function PaperButton({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  const textColor = isPrimary
    ? Paper.colors.white
    : isSecondary
    ? Paper.colors.navy
    : Paper.colors.sand;

  return (
    <Pressable
      style={[
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && styles.primaryText,
            isSecondary && styles.secondaryText,
            isGhost && styles.ghostText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primary: {
    backgroundColor: Paper.colors.orange,
    height: 54,
    borderRadius: Paper.radius.md,
  },
  secondary: {
    backgroundColor: Paper.colors.surface,
    borderWidth: 1,
    borderColor: Paper.colors.border,
    height: 48,
    borderRadius: Paper.radius.md,
  },
  ghost: {
    backgroundColor: 'transparent',
    height: 44,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {},
  primaryText: {
    color: Paper.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryText: {
    color: Paper.colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  ghostText: {
    color: Paper.colors.sand,
    fontSize: 14,
    fontWeight: '600',
  },
});
