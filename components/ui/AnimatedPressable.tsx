import React, { useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface Props {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
  scale?: number;
  haptic?: 'light' | 'medium' | 'selection' | 'none';
}

export default function AnimatedPressable({
  onPress,
  children,
  style,
  disabled = false,
  scale = 0.96,
  haptic = 'medium',
}: Props) {
  const pressed = useSharedValue(0);

  // Must run on JS thread — Haptics is not a worklet
  const fireHapticAndPress = useCallback(() => {
    if (haptic === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (haptic === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (haptic === 'selection') {
      Haptics.selectionAsync();
    }
    onPress();
  }, [haptic, onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed.value ? scale : 1, {
          mass: 0.5,
          damping: 15,
          stiffness: 300,
        }),
      },
    ],
    opacity: withTiming(disabled ? 0.4 : pressed.value ? 0.85 : 1, {
      duration: 80,
    }),
  }));

  const gesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      pressed.value = 1;
    })
    .onFinalize((_e, success) => {
      'worklet';
      pressed.value = 0;
      if (success && !disabled) {
        runOnJS(fireHapticAndPress)();
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
