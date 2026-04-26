import React from 'react';
import { Text, View } from 'react-native';
import { Paper } from '../../constants/PaperTheme';

type Props = {
  size?: number;
};

export default function Wordmark({ size }: Props) {
  const fontSize = size || Paper.type.wordmark.fontSize;
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ fontSize, fontWeight: '700', letterSpacing: -0.5, color: Paper.colors.navy }}>
        stable
      </Text>
      <Text style={{ fontSize, fontWeight: '700', letterSpacing: -0.5, color: Paper.colors.orange }}>
        pay
      </Text>
    </View>
  );
}
