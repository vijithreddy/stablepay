import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVITY_KEY = 'stablepay_activity';
const MAX_ITEMS = 50;

export type ActivityType = 'fund' | 'send';
export type ActivityStatus = 'pending' | 'confirmed' | 'failed';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  amountUsd: string;
  amountUsdc: string;
  timestamp: number;
  txHash?: string;
  status: ActivityStatus;
  paymentMethod?: string;
  recipientName?: string;
  recipientAddress?: string;
}

export async function getActivity(): Promise<ActivityItem[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as ActivityItem[];
    return items.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function addActivity(
  item: Omit<ActivityItem, 'id' | 'timestamp'>
): Promise<ActivityItem> {
  const existing = await getActivity();

  const newItem: ActivityItem = {
    ...item,
    id: Date.now().toString(),
    timestamp: Date.now(),
  };

  const updated = [newItem, ...existing].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));

  console.log('[StablePay] Activity recorded:', {
    type: newItem.type,
    amount: newItem.amountUsd,
    status: newItem.status,
  });

  return newItem;
}

export async function updateActivityStatus(
  id: string,
  status: ActivityStatus,
  txHash?: string
): Promise<void> {
  const existing = await getActivity();
  const updated = existing.map((item) =>
    item.id === id
      ? { ...item, status, ...(txHash ? { txHash } : {}) }
      : item
  );
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
