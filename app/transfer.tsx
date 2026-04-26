/**
 * Transfer Page - Send tokens to any address
 *
 * Features:
 * - Network selection (Base)
 * - Token selector
 * - Recipient address input with validation
 * - Amount input with quick % buttons (10%, 50%, 100%)
 * - USD value preview
 * - Gasless transfers on Base via Paymaster
 * - Transaction confirmation and status
 *
 * IMPORTANT: Both Base and Ethereum use Smart Account (balances stored there)
 */

import { CoinbaseAlert } from '@/components/ui/CoinbaseAlerts';
import { COLORS } from '@/constants/Colors';
import { isTestSessionActive } from '@/utils/sharedState';
import { useCurrentUser, useSendUserOperation } from '@coinbase/cdp-hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseEther, parseUnits, createPublicClient, http, formatEther } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, WHITE, BORDER } = COLORS;

export default function TransferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [network, setNetwork] = useState('base');
  const [sending, setSending] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isPendingAlert, setIsPendingAlert] = useState(false); // Track if alert is showing pending state

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { sendUserOperation, status: userOpStatus, data: userOpData, error: userOpError } = useSendUserOperation();
  const { currentUser } = useCurrentUser();

  // Get smart account address (where balances are stored for both Base and Ethereum)
  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] || null;

  // Paymaster only supports specific tokens on Base: USDC, EURC, BTC (CBBTC)
  const tokenSymbol = selectedToken?.token?.symbol?.toUpperCase() || '';
  // Paymaster support:
  // - Base mainnet: USDC, EURC, BTC only
  // - Base Sepolia: All tokens (all transactions sponsored)
  const isPaymasterSupported =
    (network === 'base' && ['USDC', 'EURC', 'BTC'].includes(tokenSymbol)) ||
    (network === 'base-sepolia');

  // Check if this is a native token transfer (ETH on EVM)
  const contractAddress = selectedToken?.token?.contractAddress;

  const isNativeToken = (
    !contractAddress ||
    contractAddress === '0x0000000000000000000000000000000000000000' ||
    contractAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
  const needsGasFee = isNativeToken && !isPaymasterSupported;

  console.log('🔍 [TRANSFER] Account addresses:', {
    smartAccountAddress,
  });

  // Watch user operation status and update alerts
  useEffect(() => {
    if (userOpStatus === 'pending' && userOpData?.userOpHash) {
      showAlert(
        'Transaction Pending ⏳',
        `User Operation Hash:\n${userOpData.userOpHash}\n\nWaiting for confirmation...\nPlease do NOT close this alert until transaction is complete. This may take a few seconds.`,
        'info',
        undefined,
        true // Mark as pending alert (hide button)
      );
    } else if (userOpStatus === 'success' && userOpData) {
      // Build explorer URL based on network and transaction hash
      const txHash = userOpData.transactionHash || userOpData.userOpHash;
      const networkLower = network.toLowerCase();

      let explorerUrl = '';
      if (networkLower === 'base') {
        explorerUrl = `https://basescan.org/tx/${txHash}`;
      } else if (networkLower === 'base-sepolia') {
        explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
      } else if (networkLower === 'ethereum') {
        explorerUrl = `https://etherscan.io/tx/${txHash}`;
      } else if (networkLower === 'ethereum-sepolia') {
        explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      } else {
        // Fallback for other networks
        explorerUrl = `Transaction Hash: ${txHash}`;
      }

      const successInfo = `🔍 TRANSACTION CONFIRMED:

User Operation Hash:
${userOpData.userOpHash}

${userOpData.transactionHash ? `Transaction Hash:\n${userOpData.transactionHash}\n\n` : ''}Status: ${userOpData.status}
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
From: ${smartAccountAddress?.slice(0, 6)}...${smartAccountAddress?.slice(-4)}`;

      showAlert(
        'Transfer Complete! ✨',
        successInfo,
        'success',
        explorerUrl
      );
    } else if (userOpStatus === 'error' && userOpError) {
      showAlert(
        'Transfer Failed ❌',
        `Error: ${userOpError.message}\n\nPlease try again or check your balance.`,
        'error'
      );
    }
  }, [userOpStatus, userOpData, userOpError]);

  // Load token data from params (only on mount)
  useEffect(() => {
    if (params.token) {
      try {
        const tokenData = JSON.parse(params.token as string);
        console.log('🔍 [TRANSFER] Loaded token data:', {
          symbol: tokenData.token?.symbol,
          contractAddress: tokenData.token?.contractAddress,
          mintAddress: tokenData.token?.mintAddress,
          amount: tokenData.amount?.amount,
          decimals: tokenData.amount?.decimals,
          network: params.network
        });
        setSelectedToken(tokenData);
      } catch (e) {
        console.error('Error parsing token data:', e);
      }
    }
    if (params.network) {
      setNetwork(params.network as string);
    }
  }, [params.token, params.network]);

  // Validate address format
  const validateAddress = (address: string) => {
    if (!address) {
      setAddressError(null);
      return false;
    }

    // EVM address validation (0x + 40 hex chars)
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setAddressError('Invalid EVM address format');
      return false;
    }

    setAddressError(null);
    return true;
  };

  // Update address and validate
  const handleAddressChange = (address: string) => {
    setRecipientAddress(address);
    if (address) {
      validateAddress(address);
    } else {
      setAddressError(null);
    }
  };

  // Helper to show custom alerts
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info', url?: string, isPending = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setExplorerUrl(url || null);
    setIsPendingAlert(isPending);
    setAlertVisible(true);
  };

  // Calculate token balance and set percentage
  const handleQuickAmount = (percentage: number) => {
    if (!selectedToken?.amount) return;

    const tokenAmount = parseFloat(selectedToken.amount.amount || '0');
    const decimals = parseInt(selectedToken.amount.decimals || '0');
    const actualBalance = tokenAmount / Math.pow(10, decimals);
    const calculatedAmount = (actualBalance * percentage) / 100;

    setAmount(calculatedAmount.toFixed(6));
  };

  const handleSend = async () => {
    // Validate inputs
    if (!validateAddress(recipientAddress)) {
      showAlert('Invalid Address', addressError || 'Please enter a valid recipient address', 'error');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount', 'error');
      return;
    }

    if (!selectedToken) {
      showAlert('No Token Selected', 'Please select a token to transfer', 'error');
      return;
    }

    // Show confirmation modal
    setShowConfirmation(true);
  };

  const handleConfirmedSend = async () => {
    setShowConfirmation(false);
    setSending(true);
    try {
      // Handle TestFlight demo mode
      if (isTestSessionActive()) {
        console.log('🧪 TestFlight mode - simulating transfer');
        await new Promise(resolve => setTimeout(resolve, 1500));

        const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
        setTxHash(mockTxHash);
        showAlert(
          'Transfer Demo Complete! 🧪',
          `TestFlight Demo Mode\n\nThis is a simulated transfer for testing the UI flow.\n\nAmount: ${amount} ${selectedToken.token.symbol}\nTo: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}\n\nIn production, this would execute a real blockchain transaction.`,
          'success'
        );
        return;
      }

      await handleEvmTransfer();
    } catch (error) {
      console.error('Transfer error:', error);
      showAlert('Transfer Failed', error instanceof Error ? error.message : 'Unknown error occurred', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleEvmTransfer = async () => {
    if (!selectedToken) return;

    // CRITICAL: Both Base and Ethereum use Smart Account (balances stored there)
    if (!smartAccountAddress) {
      showAlert('Error', 'Smart account not found. Cannot transfer funds.', 'error');
      return;
    }

    const tokenAddress = selectedToken.token?.contractAddress;
    // Treat as native if no address, zero address, or 0xeeee... sentinel (used by some SDKs)
    const isNativeTransfer = !tokenAddress ||
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Convert amount to wei (smallest unit)
    // Native ETH: Use parseEther (always 18 decimals)
    // ERC-20: Use parseUnits with token-specific decimals
    const amountInSmallestUnit = isNativeTransfer
      ? parseEther(amount)
      : parseUnits(amount, parseInt(selectedToken.amount?.decimals || '0'));

    console.log('🔍 [EVM TRANSFER] Starting transfer:', {
      network,
      tokenAddress,
      amount,
      isNativeTransfer,
      decimals: isNativeTransfer ? 18 : parseInt(selectedToken.amount?.decimals || '0'),
      smartAccountAddress,
      amountInSmallestUnit: amountInSmallestUnit.toString()
    });

    try {
      // Use sendUserOperation for both Base and Ethereum (smart account transfers)
      if (isNativeTransfer) {
        // Native ETH transfer
        console.log('💸 [TRANSFER] Sending native ETH from smart account');
        const result = await sendUserOperation({
          evmSmartAccount: smartAccountAddress as `0x${string}`,
          network: network as any,
          calls: [{
            to: recipientAddress as `0x${string}`,
            value: amountInSmallestUnit,
            data: '0x' // Empty data for native transfer
          }],
          useCdpPaymaster: isPaymasterSupported, // Paymaster only on Base for USDC/EURC/CBBTC
          // paymasterUrl: 'https://api.developer.coinbase.com/rpc/v1/base/6DmPQTz8egifUIDdGm3wl4aoXAdYWw5H'
        });

        console.log('✅ [TRANSFER] User operation submitted:', result);
        setTxHash(result.userOperationHash);

        // Status updates handled by useEffect watching userOpStatus
      } else {
        // ERC-20 token transfer
        console.log('💸 [TRANSFER] Sending ERC-20 token from smart account');
        // ERC-20 transfer function signature: transfer(address,uint256)
        const transferFunctionSelector = '0xa9059cbb';

        // Encode recipient address (32 bytes, padded)
        const encodedRecipient = recipientAddress.slice(2).padStart(64, '0');

        // Encode amount (32 bytes, padded)
        const encodedAmount = amountInSmallestUnit.toString(16).padStart(64, '0');

        // Combine into calldata
        const calldata = `${transferFunctionSelector}${encodedRecipient}${encodedAmount}`;

        const result = await sendUserOperation({
          evmSmartAccount: smartAccountAddress as `0x${string}`,
          network: network as any,
          calls: [{
            to: tokenAddress as `0x${string}`,
            value: 0n,
            data: calldata as `0x${string}`,
          }],
          useCdpPaymaster: isPaymasterSupported
        });

        console.log('✅ [TRANSFER] User operation submitted:', result);
        setTxHash(result.userOperationHash);

        // Status updates handled by useEffect watching userOpStatus
      }
    } catch (error) {
      console.error('EVM transfer error:', error);
      throw error;
    }
  };

  // REMOVED: handleSolanaTransfer — Base/EVM only

  const handleAlertDismiss = () => {
    setAlertVisible(false);
    // If it was a success alert, navigate back
    if (alertType === 'success') {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Transfer Tokens</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: CARD_BG }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Network Info */}
          <View style={styles.card}>
            <Text style={styles.label}>Network</Text>
            <Text style={styles.networkText}>
              {(() => {
                const networkLower = network?.toLowerCase() || '';
                if (networkLower === 'base') return 'Base';
                if (networkLower === 'base-sepolia') return 'Base Sepolia';
                if (networkLower === 'ethereum') return 'Ethereum';
                if (networkLower === 'ethereum-sepolia') return 'Ethereum Sepolia';
                // Capitalize first letter for unknown networks
                return network.charAt(0).toUpperCase() + network.slice(1);
              })()}
            </Text>
            {isPaymasterSupported ? (
              <Text style={styles.helper}>
                ✨ Gasless transfer powered by Coinbase Paymaster
                {network === 'base-sepolia' && ' (all tokens sponsored on testnet)'}
              </Text>
            ) : (
              <Text style={[styles.helper, { color: '#FF9800' }]}>
                ⚠️ Network fees in {isNativeToken ? selectedToken?.token?.symbol : 'ETH'} will apply to this transfer
              </Text>
            )}
          </View>

          {/* Token Info */}
          <View style={styles.card}>
            <Text style={styles.label}>Token</Text>
            {selectedToken ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.tokenSymbol}>{selectedToken.token?.symbol}</Text>
                    <Text style={styles.tokenName}>{selectedToken.token?.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>Balance</Text>
                    <Text style={styles.tokenAmount}>
                      {(parseFloat(selectedToken.amount?.amount || '0') / Math.pow(10, parseInt(selectedToken.amount?.decimals || '0'))).toFixed(6)}
                    </Text>
                    {selectedToken.usdValue && (
                      <Text style={styles.tokenUsd}>
                        ≈ ${selectedToken.usdValue.toFixed(2)} USD
                      </Text>
                    )}
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.helper}>No token selected</Text>
            )}
          </View>

          {/* Recipient Address */}
          <View style={styles.card}>
            <Text style={styles.label}>Recipient Address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { flex: 1 } , addressError && { borderColor: '#FF6B6B' }]}
                value={recipientAddress}
                onChangeText={handleAddressChange}
                placeholder="0x..."
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {recipientAddress ? (
                <Pressable
                  style={styles.pasteButton}
                  onPress={() => {
                    setRecipientAddress('');
                    setAddressError(null);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                </Pressable>
              ) : (
                <Pressable
                  style={styles.pasteButton}
                  onPress={async () => {
                    const text = await Clipboard.getStringAsync();
                    if (text) handleAddressChange(text);
                  }}
                >
                  <Ionicons name="clipboard-outline" size={20} color={BLUE} />
                </Pressable>
              )}
            </View>

            {addressError && (
              <Text style={[styles.helper, { color: '#FF6B6B', marginTop: 8 }]}>
                {addressError}
              </Text>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.card}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={TEXT_SECONDARY}
              keyboardType="decimal-pad"
            />

            {/* Quick Amount Buttons */}
            <View style={styles.quickButtons}>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(10)}
              >
                <Text style={styles.quickButtonText}>10%</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(50)}
              >
                <Text style={styles.quickButtonText}>50%</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(100)}
              >
                <Text style={styles.quickButtonText}>Max</Text>
              </Pressable>
            </View>

            {/* Warning for native tokens without paymaster */}
            {needsGasFee && (
              <Text style={[styles.helper, { color: '#FF9800', marginTop: 12 }]}>
                ⚠️ Note: You cannot transfer 100% of {selectedToken?.token?.symbol} as gas fees must be paid from your balance. Please leave some {selectedToken?.token?.symbol} for transaction fees.
              </Text>
            )}
          </View>

          {/* Send Button */}
          <Pressable
            style={[styles.mainSendButton, (!recipientAddress || !amount) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!recipientAddress || !amount || sending}
          >
            {sending ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.mainSendButtonText}>Send</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Transfer Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationHeader}>
              <Ionicons name="shield-checkmark" size={48} color={BLUE} />
              <Text style={styles.confirmationTitle}>Confirm Transfer</Text>
            </View>

            <View style={styles.confirmationBody}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>From</Text>
                <Text style={styles.confirmValue} numberOfLines={1}>
                  {smartAccountAddress?.slice(0, 6) + '...' + smartAccountAddress?.slice(-4)}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>To</Text>
                <Text style={styles.confirmValue} numberOfLines={1}>
                  {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Network</Text>
                <Text style={styles.confirmValue}>
                  {network.charAt(0).toUpperCase() + network.slice(1)}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Token</Text>
                <Text style={styles.confirmValue}>
                  {selectedToken?.token?.symbol || 'Unknown'}
                </Text>
              </View>

              <View style={[styles.confirmRow, styles.confirmAmount]}>
                <Text style={styles.confirmLabel}>Amount</Text>
                <Text style={styles.confirmAmountValue}>
                  {amount} {selectedToken?.token?.symbol}
                </Text>
              </View>

              {selectedToken?.usdValue && selectedToken?.amount && (
                <Text style={styles.confirmUsd}>
                  ≈ ${(() => {
                    // Calculate price per token from total USD value and token balance
                    const tokenBalance = parseFloat(selectedToken.amount.amount || '0') / Math.pow(10, parseInt(selectedToken.amount.decimals || '0'));
                    const pricePerToken = tokenBalance > 0 ? selectedToken.usdValue / tokenBalance : 0;
                    return (parseFloat(amount) * pricePerToken).toFixed(2);
                  })()} USD
                </Text>
              )}
            </View>

            <View style={styles.confirmationButtons}>
              <Pressable
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.sendButton]}
                onPress={handleConfirmedSend}
              >
                <Text style={styles.sendButtonText}>Confirm & Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CoinbaseAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onConfirm={() => {
          if (explorerUrl && !explorerUrl.startsWith('Transaction Hash:')) {
            Linking.openURL(explorerUrl);
          }
          handleAlertDismiss();
        }}
        confirmText={explorerUrl && !explorerUrl.startsWith('Transaction Hash:') ? "View Transaction" : "Got it"}
        hideButton={isPendingAlert} // Hide button during pending state
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_BG, // was DARK_BG
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  networkText: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  input: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  usdValue: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginTop: 8,
    marginBottom: 4,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickButton: {
    flex: 1,
    backgroundColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  mainSendButton: {
    backgroundColor: BLUE,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  mainSendButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  tokenName: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  tokenAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  tokenUsd: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmationHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginTop: 12,
  },
  confirmationBody: {
    padding: 24,
    gap: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  confirmValue: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  confirmAmount: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 8,
  },
  confirmAmountValue: {
    fontSize: 20,
    color: BLUE,
    fontWeight: '700',
  },
  confirmUsd: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'right',
    marginTop: -8,
  },
  confirmationButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: BORDER,
  },
  sendButton: {
    backgroundColor: BLUE,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
});
