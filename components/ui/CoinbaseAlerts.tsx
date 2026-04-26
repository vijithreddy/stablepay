import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paper } from '../../constants/PaperTheme';

type AlertType = 'success' | 'error' | 'info';

type CoinbaseAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  type?: AlertType;
  onCancel?: () => void;
  cancelText?: string;
  hideButton?: boolean; // Hide the button (for non-dismissible alerts like pending transactions)
};

export function CoinbaseAlert({
  visible,
  title,
  message,
  onConfirm,
  confirmText = "Got it",
  type = 'success',
  onCancel,
  cancelText = "Cancel",
  hideButton = false
}: CoinbaseAlertProps) {
  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle' as const, color: Paper.colors.success };
      case 'error': return { name: 'close-circle' as const, color: Paper.colors.error };
      case 'info': return { name: 'information-circle' as const, color: Paper.colors.orange };
    }
  };

  const icon = getIcon();
  const H = Dimensions.get('window').height;
  const insets = useSafeAreaInsets();
  
  const progress = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  
  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  
  const backdropOpacity = progress; // fade with same progress
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [H, 0],           // <-- from off-screen to fully visible
  });


  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onConfirm}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }}>
        <Animated.View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(26, 26, 46, 0.5)', opacity: backdropOpacity }]}
              pointerEvents="auto"
            >
              <Pressable style={StyleSheet.absoluteFillObject} onPress={onConfirm} />
            </Animated.View>

            <Animated.View
              style={[styles.alertCard, { width: '100%', transform: [{ translateY }] }]}
              pointerEvents="auto"
            >
              <View style={styles.handle} />
              <View style={styles.iconContainer}>
                <Ionicons name={icon.name} size={48} color={icon.color} />
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* Show buttons unless hideButton is true */}
              {!hideButton && (
                <>
                  {/* Show two buttons if onCancel is provided, otherwise single button */}
                  {onCancel ? (
                    <View style={styles.buttonRow}>
                      <Pressable
                        style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
                        onPress={onCancel}
                      >
                        <Text style={styles.buttonTextSecondary}>{cancelText}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.buttonInRow, pressed && styles.buttonPressed]}
                        onPress={onConfirm}
                      >
                        <Text style={styles.buttonText}>{confirmText}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                      onPress={onConfirm}
                    >
                      <Text style={styles.buttonText}>{confirmText}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </Animated.View>
      </View>
    </Modal>
  );
}

// Quick alert for simple messages
export function showCoinbaseAlert(
  title: string, 
  message: string, 
  type: AlertType = 'info'
): Promise<void> {
  return new Promise((resolve) => {
    // This would need a global alert manager, but for now we'll use the component approach
    resolve();
  });
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.5)',
    justifyContent: 'flex-end',
  },
  alertCard: {
    backgroundColor: Paper.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    minHeight: 220,        // ensure room for content
    maxHeight: '85%',      // avoid full-screen takeover
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Paper.colors.border,
    borderRadius: 2,
    marginBottom: 20,
    alignSelf: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Paper.colors.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Paper.colors.sand,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: Paper.colors.orange,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 25,
    minWidth: 200,
    alignSelf: 'center',
  },
  buttonInRow: {
    backgroundColor: Paper.colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    flex: 1,
    minWidth: 120,
  },
  buttonSecondary: {
    backgroundColor: Paper.colors.background,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Paper.colors.border,
    flex: 1,
    minWidth: 120,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: Paper.colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextSecondary: {
    color: Paper.colors.sand,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});