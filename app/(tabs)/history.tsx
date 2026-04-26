import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import AnimatedPressable from "../../components/ui/AnimatedPressable";
import { Paper } from "../../constants/PaperTheme";
import {
  getActivity,
  formatTimeAgo,
  ActivityItem,
} from "../../utils/activity";
import { truncateAddress } from "../../utils/contacts";

export default function History() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getActivity();
      setItems(data);
    } catch (e) {
      console.error("[History] Failed to load activity:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity])
  );

  const openTx = (txHash?: string) => {
    if (txHash) {
      Linking.openURL(`https://basescan.org/tx/${txHash}`);
    }
  };

  const renderItem = ({ item, index }: { item: ActivityItem; index: number }) => {
    const isFund = item.type === "fund";
    const isSend = item.type === "send";
    const isPending = item.status === "pending";
    const isFailed = item.status === "failed";

    const avatarBg = isFund ? Paper.colors.successLight : Paper.colors.orangeLight;
    const avatarText = isFund
      ? "↓"
      : (item.recipientName?.[0] ?? "?").toUpperCase();
    const avatarColor = isFund ? Paper.colors.success : Paper.colors.orange;

    const label = isFund
      ? "Funded via Apple Pay"
      : `Sent to ${item.recipientName || truncateAddress(item.recipientAddress || "")}`;

    const amountPrefix = isFund ? "+" : "−";
    const amountColor = isFund ? Paper.colors.success : Paper.colors.navy;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify().damping(20).stiffness(220)}
      >
        <AnimatedPressable onPress={() => openTx(item.txHash)} haptic="light">
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={[styles.avatarText, { color: avatarColor }]}>
                {avatarText}
              </Text>
            </View>

            <View style={styles.center}>
              <View style={styles.labelRow}>
                <Text style={styles.label} numberOfLines={1}>
                  {label}
                </Text>
                {isPending && <View style={styles.pendingDot} />}
                {isFailed && <View style={styles.failedDot} />}
              </View>
              <Text style={styles.time}>{formatTimeAgo(item.timestamp)}</Text>
            </View>

            <Text style={[styles.amount, { color: amountColor }]}>
              {amountPrefix}${item.amountUsd}
            </Text>
          </View>
        </AnimatedPressable>
        <View style={styles.separator} />
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Paper.colors.orange} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>📋</Text>
          </View>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyMessage}>
            Fund your wallet to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Paper.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Paper.colors.navy,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    marginLeft: 14,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: Paper.colors.navy,
    flexShrink: 1,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Paper.colors.orange,
    marginLeft: 8,
  },
  failedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Paper.colors.error,
    marginLeft: 8,
  },
  time: {
    fontSize: 12,
    color: Paper.colors.sand,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Paper.colors.borderLight,
    marginLeft: 78,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Paper.colors.surface,
    borderWidth: 1,
    borderColor: Paper.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Paper.colors.navy,
  },
  emptyMessage: {
    fontSize: 13,
    color: Paper.colors.sand,
    marginTop: 4,
  },
});
