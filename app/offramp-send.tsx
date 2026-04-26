/**
 * Offramp Send Screen
 *
 * Reached via deep link: stablepay://offramp-send?partnerUserRef=<userId>
 * after the user completes the Coinbase-hosted sell flow.
 *
 * Flow:
 * 1. Read partnerUserRef from deep link params
 * 2. Fetch offramp transaction details (to_address, sell_amount, asset, network)
 * 3. Show a locked confirmation card — amount and recipient are fixed by Coinbase
 * 4. User taps "Send Now" → executes on-chain transfer to Coinbase's to_address
 *
 * Note: The user has 30 minutes from clicking "Cash out now" on the Coinbase
 * widget to complete this on-chain send. After that the transaction expires.
 */

import { CoinbaseAlert } from '@/components/ui/CoinbaseAlerts';
import { Paper } from '@/constants/PaperTheme';
import { fetchOfframpTransaction, OfframpTransaction } from '@/utils/fetchOfframpTransaction';
import { getPendingOfframpBalance, isTestSessionActive } from '@/utils/sharedState';
import {
  useCurrentUser,
  useSendUserOperation,
} from '@coinbase/cdp-hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseEther, parseUnits } from 'viem';

// Fallback decimals for known assets when the stored balance doesn't include them
function getKnownDecimals(asset: string): number {
  switch (asset.toUpperCase()) {
    case 'ETH': return 18;
    case 'USDC':
    case 'EURC': return 6;
    case 'BTC':
    case 'CBBTC': return 8;
    default: return 18;
  }
}

export default function OfframpSendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const partnerUserRef = params.partnerUserRef as string | undefined;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<OfframpTransaction | null>(null);
  const [sending, setSending] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  const [alertHideButton, setAlertHideButton] = useState(false);

  const { sendUserOperation, status: userOpStatus, data: userOpData, error: userOpError } = useSendUserOperation();
  const { currentUser } = useCurrentUser();

  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] ?? null;
  const storedBalance = getPendingOfframpBalance();

  // Fetch transaction details on mount, retrying a few times since Coinbase
  // redirects immediately on "Cash out now" but creates the transaction asynchronously.
  useEffect(() => {
    if (!partnerUserRef) {
      setFetchError('Missing transaction reference. Please go back and try again.');
      setLoading(false);
      return;
    }

    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY_MS = 2000;

    const tryFetch = async (attempt: number) => {
      try {
        console.log(`📡 [OFFRAMP SEND] Fetching transaction, attempt ${attempt}/${MAX_ATTEMPTS}`);
        const tx = await fetchOfframpTransaction(partnerUserRef);
        if (tx) {
          setTransaction(tx);
          setLoading(false);
          return;
        }

        // Transaction not yet available — retry if we have attempts left
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          await tryFetch(attempt + 1);
        } else {
          setFetchError('Transaction not found. Coinbase may still be processing — please wait a moment and try again.');
          setLoading(false);
        }
      } catch (err: any) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          await tryFetch(attempt + 1);
        } else {
          setFetchError(err.message || 'Failed to load transaction details.');
          setLoading(false);
        }
      }
    };

    tryFetch(1);
  }, [partnerUserRef]);

  // Watch EVM user operation status
  useEffect(() => {
    if (!transaction) return;

    if (userOpStatus === 'pending' && userOpData?.userOpHash) {
      showAlert('Sending ⏳', 'Transaction submitted — waiting for confirmation.\n\nDo not close this screen.', 'info', true);
    } else if (userOpStatus === 'success' && userOpData) {
      const hash = userOpData.transactionHash || userOpData.userOpHash;
      const network = transaction.network;
      let explorerLine = '';
      if (network === 'base') explorerLine = `\n\nView on Basescan:\nhttps://basescan.org/tx/${hash}`;
      else if (network === 'ethereum') explorerLine = `\n\nView on Etherscan:\nhttps://etherscan.io/tx/${hash}`;

      showAlert(
        'Sent! ✨',
        `Successfully sent ${transaction.sell_amount.value} ${transaction.asset} to Coinbase.\n\nCoinbase will process your cash-out and deposit fiat to your account.${explorerLine}`,
        'success',
        false
      );
    } else if (userOpStatus === 'error' && userOpError) {
      showAlert('Send Failed ❌', `Error: ${userOpError.message}\n\nPlease try again.`, 'error', false);
    }
  }, [userOpStatus, userOpData, userOpError, transaction]);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info', hideButton: boolean) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertHideButton(hideButton);
    setAlertVisible(true);
  };

  const handleAlertConfirm = () => {
    setAlertVisible(false);
    if (alertType === 'success') {
      router.back();
    }
  };

  const handleSend = async () => {
    if (!transaction) return;
    setSending(true);

    try {
      if (isTestSessionActive()) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        showAlert(
          'Demo Complete 🧪',
          `TestFlight mode — this is a simulated send.\n\nIn production, this would send ${transaction.sell_amount.value} ${transaction.asset} on-chain to Coinbase's address.`,
          'success',
          false
        );
        return;
      }

      await handleEvmOfframpSend();
    } catch (err) {
      showAlert('Send Failed ❌', err instanceof Error ? err.message : 'Unknown error occurred.', 'error', false);
    } finally {
      setSending(false);
    }
  };

  const handleEvmOfframpSend = async () => {
    if (!transaction || !smartAccountAddress) {
      showAlert('Error', 'Smart account not found. Cannot send funds.', 'error', false);
      return;
    }

    const { to_address, sell_amount, asset, network } = transaction;
    const sellAmountValue = sell_amount.value;

    const contractAddress = storedBalance?.token?.contractAddress;
    const storedDecimals = storedBalance?.amount?.decimals ? parseInt(storedBalance.amount.decimals) : null;
    const decimals = storedDecimals ?? getKnownDecimals(asset);

    const isNative =
      !contractAddress ||
      contractAddress === '0x0000000000000000000000000000000000000000' ||
      contractAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    const amountBigInt = isNative
      ? parseEther(sellAmountValue)
      : parseUnits(sellAmountValue, decimals);

    const assetUpper = asset.toUpperCase();
    const isPaymasterSupported = network === 'base' && ['USDC', 'EURC', 'BTC'].includes(assetUpper);

    console.log('💸 [OFFRAMP SEND] EVM transfer:', { to_address, sell_amount: sellAmountValue, asset, network, isNative, isPaymasterSupported });

    if (isNative) {
      await sendUserOperation({
        evmSmartAccount: smartAccountAddress as `0x${string}`,
        network: network as any,
        calls: [{ to: to_address as `0x${string}`, value: amountBigInt, data: '0x' }],
        useCdpPaymaster: isPaymasterSupported,
      });
    } else {
      const transferSelector = '0xa9059cbb';
      const encodedRecipient = to_address.slice(2).padStart(64, '0');
      const encodedAmount = amountBigInt.toString(16).padStart(64, '0');
      const calldata = `${transferSelector}${encodedRecipient}${encodedAmount}` as `0x${string}`;

      await sendUserOperation({
        evmSmartAccount: smartAccountAddress as `0x${string}`,
        network: network as any,
        calls: [{ to: contractAddress as `0x${string}`, value: 0n, data: calldata }],
        useCdpPaymaster: isPaymasterSupported,
      });
    }
  };

  // REMOVED: handleSolanaOfframpSend — Base/EVM only

  const truncateAddress = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Paper.colors.sand} />
        </Pressable>
        <Text style={styles.headerTitle}>Send to Coinbase</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Loading */}
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Paper.colors.orange} />
            <Text style={styles.loadingText}>Confirming your transaction with Coinbase...</Text>
            <Text style={[styles.loadingText, { fontSize: 12, marginTop: 4 }]}>This may take a few seconds</Text>
          </View>
        )}

        {/* Fetch error */}
        {!loading && fetchError && (
          <View style={styles.card}>
            <Ionicons name="alert-circle" size={40} color="#FF6B6B" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.sectionTitle, { color: '#FF6B6B', textAlign: 'center' }]}>Transaction Not Found</Text>
            <Text style={[styles.helper, { textAlign: 'center', marginTop: 8 }]}>{fetchError}</Text>
            <Pressable style={[styles.button, { marginTop: 20 }]} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {/* Transaction details */}
        {!loading && !fetchError && transaction && (
          <>
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={18} color={Paper.colors.orange} style={{ marginTop: 1 }} />
              <Text style={styles.infoText}>
                Send the exact amount below to Coinbase&apos;s address. You have 30 minutes to complete this step.
              </Text>
            </View>

            {/* Amount card */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Amount to Send</Text>
              <Text style={styles.amountLarge}>
                {transaction.sell_amount.value} <Text style={styles.assetLabel}>{transaction.asset}</Text>
              </Text>
              <Text style={styles.networkLabel}>
                on {transaction.network.charAt(0).toUpperCase() + transaction.network.slice(1)}
              </Text>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={12} color={Paper.colors.sand} />
                <Text style={styles.lockedText}>Amount set by Coinbase — cannot be changed</Text>
              </View>
            </View>

            {/* Destination card */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Destination (Coinbase)</Text>
              <Text style={styles.addressText}>{truncateAddress(transaction.to_address)}</Text>
              <Text style={styles.helper}>This is a Coinbase-managed address generated for your transaction.</Text>
            </View>

            {/* Send button */}
            <Pressable
              style={({ pressed }) => [styles.button, styles.sendButton, sending && styles.buttonDisabled, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Paper.colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={Paper.colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>
                    Send {transaction.sell_amount.value} {transaction.asset} to Coinbase
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={styles.disclaimer}>
              Once confirmed on-chain, Coinbase will validate and process your cash-out. Fiat will be deposited to your linked account.
            </Text>
          </>
        )}
      </ScrollView>

      <CoinbaseAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onConfirm={handleAlertConfirm}
        hideButton={alertHideButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Paper.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Paper.colors.border,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Paper.colors.navy,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    color: Paper.colors.sand,
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Paper.colors.orangeLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Paper.colors.orange,
  },
  infoText: {
    flex: 1,
    color: Paper.colors.sand,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: Paper.colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    color: Paper.colors.sand,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountLarge: {
    color: Paper.colors.navy,
    fontSize: 36,
    fontWeight: '700',
  },
  assetLabel: {
    fontSize: 20,
    fontWeight: '500',
    color: Paper.colors.sand,
  },
  networkLabel: {
    color: Paper.colors.sand,
    fontSize: 14,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Paper.colors.border,
  },
  lockedText: {
    color: Paper.colors.sand,
    fontSize: 12,
  },
  addressText: {
    color: Paper.colors.navy,
    fontSize: 15,
    fontFamily: 'monospace' as any,
    fontWeight: '500',
  },
  helper: {
    color: Paper.colors.sand,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: Paper.colors.orange,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Paper.colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimer: {
    color: Paper.colors.sand,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
