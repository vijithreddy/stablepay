import AsyncStorage from '@react-native-async-storage/async-storage';

const PHONE_KEY = 'stablepay_verified_phone';
const TIMESTAMP_KEY = 'stablepay_phone_verified_at';
const CACHE_DAYS = 60;
const CACHE_MS = CACHE_DAYS * 24 * 60 * 60 * 1000;

export interface PhoneVerificationRecord {
  phoneNumber: string;      // E.164 format: +15551234567
  verifiedAt: number;       // Unix timestamp ms
  expiresAt: number;        // verifiedAt + CACHE_MS
}

export async function getVerifiedPhone(): Promise<PhoneVerificationRecord | null> {
  try {
    const phone = await AsyncStorage.getItem(PHONE_KEY);
    const timestamp = await AsyncStorage.getItem(TIMESTAMP_KEY);

    if (!phone || !timestamp) return null;

    const verifiedAt = parseInt(timestamp, 10);
    const expiresAt = verifiedAt + CACHE_MS;
    const now = Date.now();

    if (now > expiresAt) {
      await clearVerifiedPhone();
      return null;
    }

    return { phoneNumber: phone, verifiedAt, expiresAt };
  } catch {
    return null;
  }
}

export async function storeVerifiedPhone(
  phoneNumber: string
): Promise<PhoneVerificationRecord> {
  const verifiedAt = Date.now();
  const expiresAt = verifiedAt + CACHE_MS;

  await AsyncStorage.setItem(PHONE_KEY, phoneNumber);
  await AsyncStorage.setItem(TIMESTAMP_KEY, String(verifiedAt));

  console.log('[StablePay] Phone verified and stored:', {
    phoneNumber,
    verifiedAt: new Date(verifiedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    cacheDays: CACHE_DAYS,
  });

  return { phoneNumber, verifiedAt, expiresAt };
}

export async function clearVerifiedPhone(): Promise<void> {
  await AsyncStorage.multiRemove([PHONE_KEY, TIMESTAMP_KEY]);
}

export function isPhoneExpired(record: PhoneVerificationRecord): boolean {
  return Date.now() > record.expiresAt;
}
