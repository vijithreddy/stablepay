/**
 * ============================================================================
 * PROFILE PAGE - WALLET & SETTINGS MANAGEMENT (Tab 3)
 * ============================================================================
 *
 * Central hub for:
 * 1. Wallet connection & export
 * 2. Phone verification management
 * 3. Region selection (country/subdivision)
 *
 * WALLET EXPORT FLOW:
 *
 * EVM wallet only (Base):
 * 1. Click "Export private key"
 * 2. Confirmation modal (security warning)
 * 3. exportEvmAccount() from CDP
 * 4. Private key copied to clipboard
 * 5. Alert shown with security reminder
 *
 * EXPO GO LIMITATIONS:
 * - Wallet export disabled (expo-crypto doesn't support key export)
 * - Wallet creation limited (can only use previously verified emails)
 * - Shows explanatory hints in UI
 * - Button disabled with "(Expo Go)" text
 *
 * TestFlight/Production:
 * - Full wallet export supported via react-native-quick-crypto
 * - Full wallet creation for new emails
 * - Export button enabled
 *
 * PHONE VERIFICATION STATE (useFocusEffect):
 *
 * Phone state is stored in sharedState (global), but UI needs local state:
 * - Local state: verifiedPhone, phoneFresh, phoneExpiry
 * - Updated on tab focus (useFocusEffect)
 * - Also updated immediately when user unlinks phone
 *
 * Why both local and global?
 * - Global: Shared across components (OnrampForm needs phone for orders)
 * - Local: Triggers React re-renders (profile UI updates)
 * - useFocusEffect: Syncs local from global when tab becomes active
 *
 * This ensures phone state updates when:
 * - User verifies phone (returns from phone-code screen)
 * - User unlinks phone (clicks "Unlink Phone" button)
 * - User switches tabs and comes back
 *
 * REGION SELECTION IMPACT:
 *
 * Changing region triggers:
 * 1. setCountry() or setSubdivision() in sharedState
 * 2. OnrampForm remount (key=`${country}-${subdivision}`)
 * 3. fetchOptions() called with new region
 * 4. Available assets/networks/currencies update
 *
 * US subdivisions:
 * - Only shown when country is "US"
 * - Required for compliance (state regulations vary)
 * - Auto-sets to "CA" if US selected without subdivision
 *
 * @see utils/sharedState.ts for address priority system
 * @see app/phone-verify.tsx for phone verification flow
 * @see hooks/useOnramp.ts for how region affects options
 */

import {
  useCurrentUser,
  useEvmAddress,
  useExportEvmAccount,
  useIsInitialized,
  useIsSignedIn,
  useLinkSms,
  useSignInWithSms,
  useSignOut,
} from "@coinbase/cdp-hooks";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { BASE_URL } from "../../constants/BASE_URL";
import { Paper } from "../../constants/PaperTheme";
import Wordmark from "../../components/ui/Wordmark";
import { TEST_ACCOUNTS } from "../../constants/TestAccounts";
import { debugSecureStoreSession } from "../../utils/debugSession";
import { clearTestSession, daysUntilExpiry, forceUnverifyPhone, formatPhoneDisplay, getLifetimeTransactionThreshold, getVerifiedPhone, getVerifiedPhoneUserId, isPhoneFresh60d, isTestSessionActive, setCountry, setCurrentWalletAddress, setLifetimeTransactionThreshold, setManualWalletAddress, setSubdivision, setVerifiedPhone, setPendingOfframpBalance } from "../../utils/sharedState";
import { createOfframpSession } from "../../utils/createOfframpSession";
import * as WebBrowser from 'expo-web-browser';

export default function WalletScreen() {
  // Check for test session first
  const testSession = isTestSessionActive();

  // CDP hooks (only used for real accounts)
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { signOut } = useSignOut();
  const { linkSms } = useLinkSms();
  const { signInWithSms } = useSignInWithSms();

  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    type: 'success' as 'success' | 'error' | 'info'
  });

  const [showReverifyConfirm, setShowReverifyConfirm] = useState(false);
  const [reverifyPhone, setReverifyPhone] = useState<string | null>(null);
  const [debuggingSession, setDebuggingSession] = useState(false);

  // Override CDP data if test session active
  const explicitEOAAddress = testSession ? TEST_ACCOUNTS.wallets.eoaDummy : (currentUser?.evmAccounts?.[0] as string);
  const smartAccountAddress = testSession ? TEST_ACCOUNTS.wallets.evm : (currentUser?.evmSmartAccounts?.[0] as string);

  // For display: prefer smart account, then EOA
  const primaryAddress = smartAccountAddress || explicitEOAAddress;

  const { exportEvmAccount } = useExportEvmAccount();
  const { evmAddress } = useEvmAddress();

  // For export: Use EOA first, then evmAddress hook, then smart account
  const evmWalletAddress = explicitEOAAddress || evmAddress || smartAccountAddress;

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportType, setExportType] = useState<'evm'>('evm');
  const [exporting, setExporting] = useState(false);

  // Phone verification state - use local state that updates on focus
  const [verifiedPhone, setVerifiedPhoneLocal] = useState(getVerifiedPhone());
  const [phoneFresh, setPhoneFresh] = useState(isPhoneFresh60d());
  const [phoneExpiry, setPhoneExpiry] = useState(daysUntilExpiry());

  const formattedPhone = formatPhoneDisplay(verifiedPhone);
  const d = phoneExpiry;

  // Override sign-in status for test session
  const effectiveIsSignedIn = testSession || isSignedIn;
  const signedButNoSA = effectiveIsSignedIn && !primaryAddress;

  // Override email display for test session
  const displayEmail = testSession ? TEST_ACCOUNTS.email : (currentUser?.authenticationMethods.email?.email || 'No email');

  // Refresh phone verification state when tab becomes active
  useFocusEffect(
    useCallback(() => {
      setVerifiedPhoneLocal(getVerifiedPhone());
      setPhoneFresh(isPhoneFresh60d());
      setPhoneExpiry(daysUntilExpiry());
    }, [])
  );

  // Clear stale verified phone data when user changes
  useEffect(() => {
    if (!currentUser?.userId) return;

    const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;
    const storedVerifiedPhone = getVerifiedPhone();
    const storedVerifiedPhoneUserId = getVerifiedPhoneUserId();

    console.log('🔍 [PROFILE] Phone verification check:', {
      currentUserId: currentUser?.userId,
      storedUserId: storedVerifiedPhoneUserId,
      storedPhone: storedVerifiedPhone,
      cdpPhone
    });

    // Clear if verified phone belongs to a different user
    if (storedVerifiedPhone && storedVerifiedPhoneUserId && storedVerifiedPhoneUserId !== currentUser.userId) {
      console.log('🧹 [PROFILE] Clearing stale verified phone (different user)');
      setVerifiedPhone(null).then(() => {
        setVerifiedPhoneLocal(null);
        setPhoneFresh(false);
        setPhoneExpiry(-1);
      });
      return;
    }

    // Clear if phone mismatch (user unlinked phone or linked different phone)
    if (storedVerifiedPhone && cdpPhone && storedVerifiedPhone !== cdpPhone) {
      console.log('🧹 [PROFILE] Clearing stale verified phone (phone mismatch)');
      setVerifiedPhone(null).then(() => {
        setVerifiedPhoneLocal(null);
        setPhoneFresh(false);
        setPhoneExpiry(-1);
      });
    }
  }, [currentUser]);


  const [lifetimeTxThreshold, setLifetimeTxThresholdLocal] = useState(getLifetimeTransactionThreshold());

  // Balance state
  const [balances, setBalances] = useState<any[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balancesExpanded, setBalancesExpanded] = useState(false);

  // Testnet balance state
  const [testnetBalances, setTestnetBalances] = useState<any[]>([]);
  const [loadingTestnetBalances, setLoadingTestnetBalances] = useState(false);
  const [testnetBalancesError, setTestnetBalancesError] = useState<string | null>(null);
  const [testnetBalancesExpanded, setTestnetBalancesExpanded] = useState(false);

  // Save lifetime transaction threshold when changed
  useEffect(() => {
    setLifetimeTransactionThreshold(lifetimeTxThreshold);
  }, [lifetimeTxThreshold]);

  const openPhoneVerify = useCallback(async () => {
    // Use test phone for TestFlight, real phone for production
    const cdpPhone = testSession
      ? TEST_ACCOUNTS.phone
      : currentUser?.authenticationMethods?.sms?.phoneNumber;

    // If phone already linked to CDP, show re-verify confirmation (requires sign out)
    if (cdpPhone) {
      setReverifyPhone(cdpPhone);
      setShowReverifyConfirm(true);
    } else {
      // No phone linked yet, go to phone entry screen
      router.push({
        pathname: '/phone-verify',
        params: { initialPhone: verifiedPhone || '', mode: 'link' }
      });
    }
  }, [router, verifiedPhone, currentUser, testSession]);

  const handleReverifyConfirm = useCallback(async () => {
    if (!reverifyPhone) return;

    setShowReverifyConfirm(false);

    try {
      // Sign out first (skip for test sessions)
      if (!testSession) {
        await signOut();
        // Wait a moment for sign out to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('🧪 [PROFILE] Test session - skipping sign out');
      }

      // Navigate to phone-verify with phone pre-filled and auto-send enabled
      // Use replace to avoid auth gate seeing us on profile while signed out
      router.replace({
        pathname: '/phone-verify',
        params: {
          initialPhone: reverifyPhone,
          mode: 'signin',
          autoSend: 'true'
        }
      });
    } catch (error: any) {
      console.error('❌ [PROFILE] Re-verification error:', error);
      setAlertState({
        visible: true,
        title: 'Error',
        message: error.message || 'Failed to start re-verification. Please try again.',
        type: 'error'
      });
    }
  }, [reverifyPhone, signOut, router, testSession]);

  const openEmailLink = useCallback(() => {
    router.push('/email-verify?mode=link');
  }, [router]);

  // Clear UI state when user signs out
  useEffect(() => {
    if (!effectiveIsSignedIn) {
      setBalances([]);
      setBalancesError(null);
      setTestnetBalances([]);
      setTestnetBalancesError(null);
      setCurrentWalletAddress(null);
    }
  }, [effectiveIsSignedIn]);

  // Update wallet addresses when they change
  useEffect(() => {
    if (effectiveIsSignedIn) {
      setCurrentWalletAddress(primaryAddress ?? null);
    }
  }, [primaryAddress, effectiveIsSignedIn]);

  // Fetch balances when wallet addresses are available
  const fetchBalances = useCallback(async () => {
    if (!primaryAddress) return;

    setLoadingBalances(true);
    setBalancesError(null);

    try {
      // Check if TestFlight mode
      const { isTestSessionActive } = await import('@/utils/sharedState');
      const isTestFlight = isTestSessionActive();

      let accessToken: string | null = null;

      if (isTestFlight) {
        console.log('🧪 [PROFILE] TestFlight mode - using mock token');
        accessToken = 'testflight-mock-token';
      } else {
        // Get access token from CDP (real accounts)
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
        accessToken = await getAccessTokenGlobal();

        if (!accessToken) {
          console.error('❌ [PROFILE] No access token available');
          setBalancesError('Authentication required');
          setLoadingBalances(false);
    return;
        }
      }

      const allBalances: any[] = [];

      // Fetch Base balances
      if (primaryAddress) {
        try {
          const baseResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=base`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (baseResponse.ok) {
            const baseData = await baseResponse.json();
            allBalances.push(...(baseData.balances || []).map((b: any) => ({ ...b, network: 'Base' })));
          }
        } catch (e) {
          console.error('Error fetching Base balances:', e);
        }
      }

      setBalances(allBalances);
      console.log(`✅ [PROFILE] Loaded ${allBalances.length} mainnet token balances`);
    } catch (error) {
      console.error('❌ [PROFILE] Error fetching mainnet balances:', error);
      setBalancesError('Failed to load balances');
    } finally {
      setLoadingBalances(false);
    }
  }, [primaryAddress]);

  // Fetch testnet balances
  const fetchTestnetBalances = useCallback(async () => {
    if (!primaryAddress) return;

    setLoadingTestnetBalances(true);
    setTestnetBalancesError(null);

    try {
      // Check if TestFlight mode
      const { isTestSessionActive } = await import('@/utils/sharedState');
      const isTestFlight = isTestSessionActive();

      let accessToken: string | null = null;

      if (isTestFlight) {
        console.log('🧪 [PROFILE] TestFlight mode - using mock token for testnet');
        accessToken = 'testflight-mock-token';
      } else {
        // Get access token from CDP (real accounts)
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
        accessToken = await getAccessTokenGlobal();

        if (!accessToken) {
          console.error('❌ [PROFILE] No access token available for testnet');
          setTestnetBalancesError('Authentication required');
          setLoadingTestnetBalances(false);
      return;
        }
      }

      const allTestnetBalances: any[] = [];

      // Fetch Base Sepolia testnet balances
      if (primaryAddress) {
        try {
          const baseSepoliaResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=base-sepolia`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (baseSepoliaResponse.ok) {
            const baseSepoliaData = await baseSepoliaResponse.json();
            allTestnetBalances.push(...(baseSepoliaData.balances || []).map((b: any) => ({ ...b, network: 'Base Sepolia' })));
          }
        } catch (e) {
          console.error('Error fetching Base Sepolia testnet balances:', e);
        }
      }

      setTestnetBalances(allTestnetBalances);
      console.log(`✅ [PROFILE] Loaded ${allTestnetBalances.length} testnet token balances`);
    } catch (error) {
      console.error('❌ [PROFILE] Error fetching testnet balances:', error);
      setTestnetBalancesError('Failed to load testnet balances');
    } finally {
      setLoadingTestnetBalances(false);
    }
  }, [primaryAddress]);

  // Fetch balances on mount and when addresses change
  useEffect(() => {
    if (effectiveIsSignedIn && primaryAddress) {
      fetchBalances();
      fetchTestnetBalances();
    }
  }, [effectiveIsSignedIn, primaryAddress, fetchBalances, fetchTestnetBalances]);

  // Re-fetch balances when profile tab comes into focus
  useFocusEffect(
    useCallback(() => {
      if (effectiveIsSignedIn && primaryAddress) {
        console.log('🔄 [PROFILE] Tab focused - refreshing balances');
        fetchBalances();
        fetchTestnetBalances();
      }
    }, [effectiveIsSignedIn, primaryAddress, fetchBalances, fetchTestnetBalances])
  );

  const handleDebugSession = useCallback(async () => {
    setDebuggingSession(true);
    try {
      const debugInfo = await debugSecureStoreSession();
      setAlertState({
        visible: true,
        title: 'Session Debug',
        message: debugInfo,
        type: 'info'
      });
    } catch (error: any) {
      setAlertState({
        visible: true,
        title: 'Debug Error',
        message: `Failed to debug session:\n${error.message}`,
        type: 'error'
      });
    } finally {
      setDebuggingSession(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      // Check if this is a test session
      if (isTestSessionActive()) {
        console.log('🧪 Clearing test session');
        await clearTestSession();
      } else {
        // Real CDP sign out
      await signOut();
      }
    } catch (e) {
      console.warn('signOut error', e);
    } finally {
      // Clear all user-specific state
      setCurrentWalletAddress(null);
      setManualWalletAddress(null);
      // DON'T clear verifiedPhone - let useEffect cleanup handle it when different user signs in
      // This allows same user to re-sign in without re-verifying within 60 days
      setCountry('US'); // Reset to default
      setSubdivision('CA'); // Reset to default

      // Navigate to login screen
      router.replace('/auth/login');
    }
  }, [signOut, router]);

  

  const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRequestExport = () => {
    if (!effectiveIsSignedIn || !evmWalletAddress) return;

    if (isExpoGo) {
      setAlertState({
        visible: true,
        title: "Export not available",
        message: "Private key export is not available in Expo Go. Please use a development build or TestFlight.",
        type: "info",
      });
      return;
    }

    setExportType('evm');
    setShowExportConfirm(true);
  };

  const handleConfirmedExport = async () => {
    // Check if this is a test account (TestFlight)
    if (isTestSessionActive()) {
      console.log('🧪 Test account - exporting mock seed phrase');
    setExporting(true);
    try {
        // Copy mock seed phrase to clipboard
        await Clipboard.setStringAsync(TEST_ACCOUNTS.seedPhrase);
      setAlertState({
        visible: true,
          title: "Mock Seed Phrase Copied (TestFlight)",
          message: `This is a mock seed phrase for TestFlight testing only:\n\n"${TEST_ACCOUNTS.seedPhrase}"\n\nNo real wallet exists. This is for demonstration purposes only.`,
        type: "info",
      });
    } catch (e) {
      setAlertState({
        visible: true,
        title: "Export failed",
          message: "Unable to copy mock seed phrase to clipboard.",
        type: "error",
      });
    } finally {
      setExporting(false);
      setShowExportConfirm(false);
    }
      return;
    }

    // Real account export flow (EVM/Base only)
    if (!evmWalletAddress) {
    setAlertState({
      visible: true,
        title: "Export failed",
        message: "No EVM address found for export.",
        type: "error",
      });
      return;
    }

    setExporting(true);
    try {
      console.log('Exporting EVM wallet:', evmWalletAddress);
      const result = await exportEvmAccount({ evmAccount: evmWalletAddress! as `0x${string}` });

      await Clipboard.setStringAsync(result.privateKey);
      setAlertState({
        visible: true,
        title: "Private key copied",
        message: "Your EVM private key has been copied to the clipboard. Store it securely and clear your clipboard.",
      type: "info",
    });
    } catch (e) {
      console.error('Export Error Details:', e);

      // Get detailed error information
      let errorMessage = "Unable to export private key.";
      let errorDetails = "";

      if (e instanceof Error) {
        errorMessage = e.message;
        errorDetails = `\n\nError Type: ${e.name}`;
        if (e.stack) {
          // Show first few lines of stack for debugging
          const stackLines = e.stack.split('\n').slice(0, 3);
          errorDetails += `\nStack: ${stackLines.join('\n')}`;
        }
      } else if (typeof e === 'object' && e !== null) {
        errorMessage = JSON.stringify(e, null, 2);
      } else {
        errorMessage = String(e);
      }

      setAlertState({
        visible: true,
        title: "Export failed",
        message: `${errorMessage}${errorDetails}\n\nWallet: EVM\nAddress: ${evmWalletAddress}`,
        type: "error",
      });
    } finally {
      setExporting(false);
      setShowExportConfirm(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Paper.colors.orange} />
        <Text style={styles.loadingText}>Setting up StablePay...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(displayEmail || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.emailText}>{displayEmail}</Text>
          <Text style={styles.walletLabel}>CDP Embedded Wallet</Text>
        </View>

        {/* Wallet card */}
        {primaryAddress && (
          <View style={styles.walletCard}>
            <Text style={styles.walletCardLabel}>WALLET ADDRESS</Text>
            <View style={styles.addressRow}>
              <Text style={styles.walletAddress}>
                {primaryAddress.slice(0, 6)}...{primaryAddress.slice(-4)}
              </Text>
              <Pressable
                style={styles.copyPill}
                onPress={async () => {
                  await Clipboard.setStringAsync(primaryAddress);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </Pressable>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.networkBadge}>
                <Text style={styles.networkBadgeText}>Base Mainnet</Text>
              </View>
              <View style={styles.gaslessBadge}>
                <Text style={styles.gaslessBadgeText}>Gasless</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sign out */}
        <Pressable style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <CoinbaseAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onConfirm={() => setAlertState({ ...alertState, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Paper.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  heading: {
    ...Paper.type.heading,
    color: Paper.colors.navy,
    marginBottom: 28,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Paper.colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: Paper.colors.background,
  },
  emailText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: Paper.colors.navy,
  },
  walletLabel: {
    fontSize: 12,
    color: Paper.colors.sand,
    marginTop: 3,
  },
  walletCard: {
    backgroundColor: Paper.colors.surface,
    borderRadius: Paper.radius.lg,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  walletCardLabel: {
    ...Paper.type.label,
    color: Paper.colors.sand,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletAddress: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 14,
    fontWeight: '600',
    color: Paper.colors.navy,
    flex: 1,
  },
  copyPill: {
    backgroundColor: Paper.colors.orangeLight,
    borderRadius: Paper.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Paper.colors.orange,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  networkBadge: {
    backgroundColor: '#EBF2FF',
    borderRadius: Paper.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#185FA5',
  },
  gaslessBadge: {
    backgroundColor: Paper.colors.successLight,
    borderRadius: Paper.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  gaslessBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Paper.colors.success,
  },
  signOutButton: {
    marginTop: 32,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: Paper.colors.sand,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Paper.colors.background,
  },
  loadingText: {
    fontSize: 14,
    color: Paper.colors.sand,
    marginTop: 16,
  },
});