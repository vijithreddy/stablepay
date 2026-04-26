/**
 * ============================================================================
 * HOME/INDEX - MAIN STABLEPAY PAGE (Tab 1)
 * ============================================================================
 *
 * This is the main page where users send USDC on Base via Apple Pay.
 * It coordinates:
 * - OnrampForm component (user input)
 * - useOnramp hook (API calls)
 * - APIGuestCheckoutWidget component (Apple Pay payment processing)
 * - Wallet connection state
 *
 * ADDRESS STATE MANAGEMENT (Critical for UX):
 *
 * Three address-related states:
 * 1. address: Current form input (what user sees in form)
 * 2. connectedAddress: Wallet connection status (for "Connected" button)
 * 3. isConnected: Derived boolean (has a wallet)
 *
 * Why separate states?
 * - address: Can be empty for unsupported networks
 * - connectedAddress: Still valid (user HAS a wallet)
 * - isConnected: Shows "Connected" button (user is signed in with wallet)
 *
 * NETWORK POLLING (200ms interval):
 *
 * Polls getCurrentNetwork() to detect changes from OnrampForm:
 * 1. Form dropdown changes network
 * 2. setCurrentNetwork() called in sharedState
 * 3. Polling detects change (trackedNetwork !== currentNetwork)
 * 4. Calls getCurrentWalletAddress() for new network
 * 5. Updates address and connectedAddress
 *
 * Why polling instead of callback?
 * - Shared state is global (not React state)
 * - Multiple components can change network
 * - Polling ensures all components stay in sync
 * - 200ms is fast enough for real-time feel, low overhead
 *
 * PHONE VERIFICATION FLOW (Apple Pay only):
 *
 * Decision tree for submission:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ User clicks "Swipe to Deposit"                              │
 * │   ↓                                                         │
 * │ Apple Pay → Check phone verification:                       │
 * │       ├─ Has fresh phone? → createOrder()                  │
 * │       └─ No phone? → setPendingForm() → /phone-verify      │
 * └─────────────────────────────────────────────────────────────┘
 *
 * PENDING FORM RESUMPTION:
 *
 * When user returns from phone verification:
 * 1. useFocusEffect detects tab focus
 * 2. Checks getPendingForm() for saved form data
 * 3. Verifies phone is fresh, then creates order
 * 5. Clears pending form to prevent re-processing
 *
 * WALLET INITIALIZATION (Multiple sources):
 *
 * CDP wallets can come from multiple sources:
 * - currentUser.evmAccounts[0]: EOA (Externally Owned Account)
 * - currentUser.evmSmartAccounts[0]: Smart Account (Account Abstraction)
 * - evmAddress hook: Fallback EVM address
 *
 * Priority for setting shared state:
 * EVM: evmEOA > evmSmartAccount > evmAddress hook
 *
 * This runs in multiple useEffects to handle:
 * - Initial load (may take 5s for wallet creation)
 * - Tab focus (user might verify in another tab)
 * - Network changes
 *
 * @see components/onramp/OnrampForm.tsx for form UI
 * @see components/onramp/APIGuestCheckoutWidget.tsx for payment WebView
 * @see hooks/useOnramp.ts for API calls
 * @see utils/sharedState.ts for address resolution
 */

import { useCurrentUser, useEvmAddress, useIsSignedIn, useSignOut, useSendUserOperation } from "@coinbase/cdp-hooks";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { BASE_URL } from "../../constants/BASE_URL";
import { APIGuestCheckoutWidget, OnrampForm, useOnramp } from "../../components";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { Paper } from "../../constants/PaperTheme";
import Wordmark from "../../components/ui/Wordmark";
import { TEST_ACCOUNTS } from "../../constants/TestAccounts";
import { clearPhoneVerifyWasCanceled, getCountry, getCurrentNetwork, getCurrentPartnerUserRef, getCurrentWalletAddress, getPendingForm, getPhoneVerifyWasCanceled, getSubdivision, getTestWalletEvm, getVerifiedPhone, isPhoneFresh60d, isTestSessionActive, setCurrentWalletAddress, setPendingForm } from "../../utils/sharedState";
import { createGuestCheckoutDebugInfo, openSupportEmail, SUPPORT_EMAIL } from "../../utils/supportEmail";
import PhoneVerificationSheet from "../../components/onramp/PhoneVerificationSheet";
import { getVerifiedPhone as getPhoneRecord } from "../../utils/phoneVerification";
import { getContacts, seedDemoContacts, Contact } from '../../utils/contacts';
import { addActivity } from '../../utils/activity';
import ContactPicker from '../../components/ui/ContactPicker';
import AddContactSheet from '../../components/ui/AddContactSheet';
import ConfirmSendSheet from '../../components/ui/ConfirmSendSheet';



function generateMockAddress(): string {
  const hexChars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 40; i++) {
    const idx = Math.floor(Math.random() * hexChars.length);
    result += hexChars[idx];
  }
  return result;
}

export default function Index() {
  const [address, setAddress] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [amount, setAmount] = useState("");
  const router = useRouter();
  const pendingForm = getPendingForm();

  // Store current transaction details for alert messages
  const [currentTransaction, setCurrentTransaction] = useState<{
    amount: string;
    paymentCurrency: string;
    asset: string;
    network: string;
  } | null>(null);

  


  // Check for test session first
  const testSession = isTestSessionActive();

  // CDP hooks (overridden for test session)
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { evmAddress: cdpEvmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const { sendUserOperation } = useSendUserOperation();
  const [connectedAddress, setConnectedAddress] = useState('');

  // Override addresses for test session
  const evmAddress = testSession ? getTestWalletEvm() : cdpEvmAddress;

  // Wallet is connected if user has an EVM wallet
  const hasEvmWallet = testSession ? !!getTestWalletEvm() : !!(currentUser?.evmAccounts?.[0] || currentUser?.evmSmartAccounts?.[0] || evmAddress);
  const effectiveIsSignedIn = testSession || isSignedIn;
  const isConnected = effectiveIsSignedIn && hasEvmWallet;
  const walletReady = !!(address || getCurrentWalletAddress() || connectedAddress);

  const [trackedNetwork, setTrackedNetwork] = useState(getCurrentNetwork());

  // Initialize on mount AND when test session changes
  useEffect(() => {
    const walletAddress = getCurrentWalletAddress();
    if (walletAddress) {
      setConnectedAddress(walletAddress);
      setAddress(walletAddress);
    }
  }, [testSession]); // Re-run when test session changes

  // Watch for network changes and update address accordingly
  useEffect(() => {
    const interval = setInterval(() => {
      const currentNetwork = getCurrentNetwork();
      if (currentNetwork !== trackedNetwork) {
        setTrackedNetwork(currentNetwork);

        // getCurrentWalletAddress() returns wallet address (network-aware), null for unsupported networks
        const walletAddress = getCurrentWalletAddress();
        if (walletAddress) {
          setConnectedAddress(walletAddress);
          setAddress(walletAddress);
        } else {
          // No address available for this network (e.g., unsupported network in prod)
          setConnectedAddress('');
          setAddress('');
        }
      }
    }, 200); // Poll every 200ms for network changes

    return () => clearInterval(interval);
  }, [trackedNetwork]);

  // Watch for wallet address changes when user is signed in or when addresses load
  useEffect(() => {
    const walletAddress = getCurrentWalletAddress();

    if (effectiveIsSignedIn && walletAddress) {
      // User is signed in and we have an address - update if different
      setConnectedAddress(prev => prev !== walletAddress ? walletAddress : prev);
      setAddress(prev => prev !== walletAddress ? walletAddress : prev);
    } else if (!effectiveIsSignedIn) {
      // User signed out, clear addresses
      setConnectedAddress('');
      setAddress('');
    }
  }, [effectiveIsSignedIn, currentUser, evmAddress]);

  useFocusEffect(
    useCallback(() => {
      const walletAddress = getCurrentWalletAddress();
      setConnectedAddress(walletAddress ?? '');
      // Always update address on focus (important for test account returning from verification)
      if (walletAddress) {
        setAddress(walletAddress);
      }
    }, [])
  );

  // Update shared state and local state when CDP wallet addresses load
  useEffect(() => {
    if (!effectiveIsSignedIn) return;

    // Skip CDP polling for test session (addresses already set)
    if (testSession) {
      const walletAddress = getCurrentWalletAddress();
      if (walletAddress) {
        setConnectedAddress(walletAddress);
        if (!address) setAddress(walletAddress);
      }
      return;
    }

    // Get EVM addresses from CDP hooks
    const evmSmartAccount = currentUser?.evmSmartAccounts?.[0] as string;
    const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;

    // Set in shared state (so getCurrentWalletAddress works)
    // IMPORTANT: Prioritize Smart Account over EOA for onramp (balances are in Smart Account)
    const primaryEvmAddress = evmSmartAccount || evmEOA;
    if (primaryEvmAddress) {
      setCurrentWalletAddress(primaryEvmAddress);
    }

    // Get network-aware wallet address from shared state
    const walletAddress = getCurrentWalletAddress();

    if (walletAddress) {
      setConnectedAddress(walletAddress);
      if (!address) setAddress(walletAddress);
      return;
    }

    // Poll if not found immediately
    let tries = 0;
    const t = setInterval(() => {
      const polledAddress = getCurrentWalletAddress();

      if (polledAddress) {
        setConnectedAddress(polledAddress);
        if (!address) setAddress(polledAddress);
        clearInterval(t);
      }
      if (++tries > 30) clearInterval(t); // 15s max for Smart Account creation
    }, 500);

    return () => clearInterval(t);
  }, [effectiveIsSignedIn, testSession, currentUser, evmAddress]);

  useFocusEffect(
    useCallback(() => {
      // Check wallet status when tab becomes active - network-aware
      if (effectiveIsSignedIn) {
        const walletAddress = getCurrentWalletAddress();

        if (walletAddress) {
          setConnectedAddress(walletAddress);
          if (!address) setAddress(walletAddress);
        }
      } else {
        setConnectedAddress('');
      }
    }, [effectiveIsSignedIn, currentUser, address, evmAddress])
  );

  

  useFocusEffect(
    useCallback(() => {
      setAddress(getCurrentWalletAddress() ?? "");
    }, [])
  );


  const [applePayAlert, setApplePayAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    navigationPath?: string;
    onConfirmCallback?: () => Promise<void> | void;
    onCancelCallback?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    navigationPath: undefined,
    onConfirmCallback: undefined,
    onCancelCallback: undefined,
    confirmText: undefined,
    cancelText: undefined
  });


  const {
    createOrder,
    closeGuestCheckout,
    options,
    isLoadingOptions,
    optionsError,
    getAvailableNetworks,
    getAvailableAssets,
    fetchOptions,
    guestCheckoutVisible,
    activePaymentMethod,
    isSandboxOrder,
    hostedUrl,
    isProcessingPayment,
    setTransactionStatus,
    setIsProcessingPayment,
    paymentCurrencies,
    buyConfig,
    getNetworkNameFromDisplayName,
    getAssetSymbolFromName
  } = useOnramp();

  const displayEmail = testSession ? 'demo@stablepay.com' : (currentUser?.authenticationMethods?.email?.email || '');
  const userInitial = (displayEmail?.[0] ?? 'U').toUpperCase();

  // Balance state
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Quick amount selection (for zero-balance state)
  const [selectedQuickAmount, setSelectedQuickAmount] = useState('25');
  const quickAmounts = ['10', '25', '50', '100'];

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Fetch USDC balance on Base
  const fetchBalance = useCallback(async () => {
    const walletAddr = getCurrentWalletAddress();
    if (!walletAddr) return;

    setLoadingBalance(true);
    setConnectionError(null);
    try {
      const isTestFlight = isTestSessionActive();
      let accessToken: string | null = null;
      if (isTestFlight) {
        accessToken = 'testflight-mock-token';
      } else {
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
        accessToken = await getAccessTokenGlobal();
      }
      if (!accessToken) { setLoadingBalance(false); return; }

      console.log('[StablePay] Fetching balance from:', `${BASE_URL}/balances/evm`);
      const res = await fetch(`${BASE_URL}/balances/evm?address=${walletAddr}&network=base`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        const usdc = (data.balances || []).find((b: any) => b.token?.symbol === 'USDC');
        if (usdc) {
          const raw = parseFloat(usdc.amount?.amount || '0');
          const decimals = parseInt(usdc.amount?.decimals || '6');
          setUsdcBalance(raw / Math.pow(10, decimals));
        } else {
          setUsdcBalance(0);
        }
      } else {
        console.error('[StablePay] Balance fetch failed:', res.status);
        setConnectionError('Connection error — check server');
      }
    } catch (e) {
      console.error('[StablePay] Balance fetch error:', e);
      setConnectionError('Connection error — check server');
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // Fetch balance on mount and focus
  useEffect(() => {
    if (effectiveIsSignedIn && getCurrentWalletAddress()) fetchBalance();
  }, [effectiveIsSignedIn, connectedAddress, fetchBalance]);

  useFocusEffect(useCallback(() => {
    if (effectiveIsSignedIn && getCurrentWalletAddress()) fetchBalance();
  }, [effectiveIsSignedIn, fetchBalance]));

  const hasBalance = usdcBalance !== null && usdcBalance > 0;
  const balanceDisplay = usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : '$0.00';

  // Refetch options is handled on screen focus and within OnrampForm when needed

  // Track region changes and refetch buy options
  const [lastRegion, setLastRegion] = useState(() => `${getCountry()}-${getSubdivision()}`);

  // Poll for region changes (detects changes from OnrampForm selectors)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentRegion = `${getCountry()}-${getSubdivision()}`;
      if (currentRegion !== lastRegion) {
        console.log('🌍 Region changed, refetching buy options:', { from: lastRegion, to: currentRegion });
        setLastRegion(currentRegion);
        if (effectiveIsSignedIn) {
          fetchOptions();
        }
      }
    }, 500); // Check every 500ms

    return () => clearInterval(intervalId);
  }, [lastRegion, effectiveIsSignedIn, fetchOptions]);

  // Fetch options on component mount (only when signed in)
  useFocusEffect(
    useCallback(() => {
      if (effectiveIsSignedIn) {
        fetchOptions(); // only refetch options on focus when logged in
      }
      if (getPhoneVerifyWasCanceled()) {
        setIsProcessingPayment(false); // reset slider
        clearPhoneVerifyWasCanceled();
      }
    }, [fetchOptions, setIsProcessingPayment, effectiveIsSignedIn])
  );

  // 1) Resume after returning to this tab
  useFocusEffect(
    useCallback(() => {
      if (!pendingForm) return;

      const handlePendingForm = async () => {
        try {
          // Apple Pay path - wait for user to be signed in before proceeding
          if (!effectiveIsSignedIn) {
            return; // Wait for next render when user is signed in
          }

          // Apple Pay path still requires fresh phone
          const phoneFresh = isPhoneFresh60d();
          const verifiedPhone = getVerifiedPhone();

          if (phoneFresh && verifiedPhone) {
            const phone = verifiedPhone;

            // CRITICAL: Convert display names to API format (e.g., "Base" → "base", "USD Coin" → "USDC")
            // This is the same conversion that happens in handleSubmit but was missing here
            const networkApiName = getNetworkNameFromDisplayName(pendingForm.network);
            const assetApiName = getAssetSymbolFromName(pendingForm.asset);

            // Determine the correct EVM address for pending form
            let targetAddress = pendingForm.address;
            const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
            const evmSmart = currentUser?.evmSmartAccounts?.[0] as string;
            // Prioritize Smart Account for onramp (balances stored there)
            targetAddress = evmSmart || evmEOA || targetAddress;

            // Update form data with converted API names and correct address
            const updatedFormData = {
              ...pendingForm,
              network: networkApiName,
              asset: assetApiName,
              phoneNumber: phone,
              address: targetAddress
            };

            // Store transaction details for alert messages
            setCurrentTransaction({
              amount: updatedFormData.amount,
              paymentCurrency: updatedFormData.paymentCurrency || 'USD',
              asset: assetApiName,
              network: networkApiName
            });

            createOrder(updatedFormData);
            setPendingForm(null);
          }
        } catch (error) {
          setPendingForm(null); // Clear pending form on error
          const errorMessage = error instanceof Error ? error.message : 'Unable to create transaction. Please try again.';
          setApplePayAlert({
            visible: true,
            title: 'Transaction Failed',
            message: `${errorMessage}\n\nContact ${SUPPORT_EMAIL} for support.`,
            type: 'error',
            confirmText: 'Email Support',
            onConfirmCallback: async () => {
              const debugInfo = createGuestCheckoutDebugInfo({
                errorMessage: errorMessage,
                debugMessage: 'Transaction failed during pending form resumption',
              });
              await openSupportEmail(debugInfo);
            },
            onCancelCallback: () => {}
          });
        }
      };
      handlePendingForm();
    }, [pendingForm, createOrder, getNetworkNameFromDisplayName, getAssetSymbolFromName, currentUser, evmAddress, effectiveIsSignedIn])
  );

  const handleSubmit = useCallback(async (formData: any) => {
    setIsProcessingPayment(true);

    // CRITICAL: Convert display names to API format (e.g., "Base" → "base", "USD Coin" → "USDC")
    const networkApiName = getNetworkNameFromDisplayName(formData.network);
    const assetApiName = getAssetSymbolFromName(formData.asset);

    // Determine the correct EVM address
    let targetAddress = formData.address;
    const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
    const evmSmart = currentUser?.evmSmartAccounts?.[0] as string;
    targetAddress = evmEOA || evmSmart || targetAddress;

    // Fallback: ensure address is never empty string
    if (!targetAddress) {
      targetAddress = getCurrentWalletAddress() || connectedAddress || '';
    }
    if (!targetAddress) {
      console.error('[StablePay] No wallet address available for transaction');
      setIsProcessingPayment(false);
      return;
    }

    // Update the form data with converted API names and correct address
    const updatedFormData = {
      ...formData,
      network: networkApiName,
      asset: assetApiName,
      address: targetAddress
    };

    try {
      // Store transaction details for alert messages
      setCurrentTransaction({
        amount: updatedFormData.amount,
        paymentCurrency: updatedFormData.paymentCurrency || 'USD',
        asset: assetApiName,
        network: networkApiName
      });

      // Apple Pay: createOrder will validate email + phone and throw appropriate errors
      await createOrder(updatedFormData);
    } catch (error: any) {
      const paymentLabel = 'Apple Pay';

      if (error.code === 'MISSING_EMAIL') {
        setPendingForm(updatedFormData);
        setApplePayAlert({
          visible: true,
          title: `Link Email for ${paymentLabel}`,
          message: `${paymentLabel} requires both email and phone verification for compliance.\n\nWould you like to link your email to this account to continue?`,
          type: 'info',
          navigationPath: '/email-verify?mode=link'
        });
        return;
      }

      // Handle missing phone - show confirmation before linking/verifying
      if (error.code === 'MISSING_PHONE') {
        setPendingForm(updatedFormData);
        // Use test phone for test sessions, real phone for production
        const cdpPhone = testSession
          ? TEST_ACCOUNTS.phone
          : currentUser?.authenticationMethods?.sms?.phoneNumber;

        // If phone is linked to CDP but not verified/expired, use re-verify flow
        if (cdpPhone) {
          const isUSPhone = cdpPhone.startsWith('+1');
          const disclaimer = isUSPhone ? '' : `\n\nNote: ${paymentLabel} is only available for US phone numbers. You can use this flow to experience the verification process.`;

          setApplePayAlert({
            visible: true,
            title: `Re-verify Phone for ${paymentLabel}`,
            message: `Your phone is linked but needs verification.\n\nTo verify, we need to sign you out and send a verification code to your phone.\n\nWould you like to continue?${disclaimer}`,
            type: 'info',
            onConfirmCallback: async () => {
              try {
                console.log('🔄 [INDEX] Starting phone verification');

                // Sign out first (skip for test sessions)
                if (!testSession) {
                  console.log('🔄 [INDEX] Signing out for re-verification');
                  await signOut();
                  // Wait for sign out to complete
                  await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                  console.log('🧪 [INDEX] Test session - skipping sign out');
                }

                console.log('✅ [INDEX] Navigating to phone-verify with pre-filled number');

                // Navigate to phone-verify with phone pre-filled and auto-send enabled
                router.replace({
                  pathname: '/phone-verify',
                  params: {
                    initialPhone: cdpPhone,
                    mode: 'signin',
                    autoSend: 'true'
                  }
                });
              } catch (signOutError: any) {
                console.error('❌ [INDEX] Verification error:', signOutError);
                setApplePayAlert({
                  visible: true,
                  title: 'Error',
                  message: signOutError.message || 'Failed to start verification. Please try again.',
                  type: 'error'
                });
              }
            },
            onCancelCallback: () => {
              // Cancel re-verification - clear pending form and reset processing state
              console.log('❌ [INDEX] User canceled phone re-verification');
              setPendingForm(null);
              setIsProcessingPayment(false);
            }
          });
        } else {
          // No phone linked at all - use link mode
          setApplePayAlert({
            visible: true,
            title: `Link Phone for ${paymentLabel}`,
            message: `${paymentLabel} requires both email and phone verification for compliance.\n\nWould you like to link your phone to this account to continue?`,
            type: 'info',
            navigationPath: '/phone-verify?mode=link'
          });
        }
        return;
      }

      // Handle expired phone - show confirmation before re-verifying
      if (error.code === 'PHONE_EXPIRED') {
        setPendingForm(updatedFormData);
        const expiredPhone = getVerifiedPhone();
        const isUSPhone = expiredPhone?.startsWith('+1');
        const disclaimer = isUSPhone ? '' : `\n\nNote: ${paymentLabel} is only available for US phone numbers. You can use this flow to experience the verification process.`;

        setApplePayAlert({
          visible: true,
          title: 'Re-verify Phone for Apple Pay',
          message: `Your phone verification has expired (valid for 60 days).\n\nTo re-verify, we need to sign you out and send a new verification code to your phone.\n\nWould you like to continue?${disclaimer}`,
          type: 'info',
          onConfirmCallback: async () => {
            try {
              console.log('🔄 [INDEX] Starting phone re-verification - signing out');

              // Sign out first
              await signOut();

              // Wait for sign out to complete
              await new Promise(resolve => setTimeout(resolve, 500));

              console.log('✅ [INDEX] Signed out, navigating to phone-verify with pre-filled number');

              // Navigate to phone-verify with phone pre-filled and auto-send enabled
              router.replace({
                pathname: '/phone-verify',
                params: {
                  initialPhone: expiredPhone,
                  mode: 'signin',
                  autoSend: 'true'
                }
              });
            } catch (signOutError: any) {
              console.error('❌ [INDEX] Re-verification error:', signOutError);
              setApplePayAlert({
                visible: true,
                title: 'Error',
                message: signOutError.message || 'Failed to start re-verification. Please try again.',
                type: 'error'
              });
            }
          },
          onCancelCallback: () => {
            // Cancel re-verification - clear pending form and reset processing state
            console.log('❌ [INDEX] User canceled phone re-verification');
            setPendingForm(null);
            setIsProcessingPayment(false);
          }
        });
        return;
      }

      // Handle non-US phone - show info alert
      if (error.code === 'NON_US_PHONE') {
        setPendingForm(null); // Clear pending form since this requires user action
        setApplePayAlert({
          visible: true,
          title: 'US Phone Required',
          message: `${paymentLabel} is only available for US phone numbers.\n\nPlease link a US phone number to your account to continue.`,
          type: 'info'
        });
        setIsProcessingPayment(false);
        return;
      }

      // Generic error - show support option
      const errorMessage = error instanceof Error ? error.message : 'Unable to create transaction. Please try again.';
      setApplePayAlert({
        visible: true,
        title: 'Transaction Failed',
        message: `${errorMessage}\n\nContact ${SUPPORT_EMAIL} for support. We'll resolve the issue within 1 business day.`,
        type: 'error',
        confirmText: 'Email Support',
        onConfirmCallback: async () => {
          // Open email with debug info
          const debugInfo = createGuestCheckoutDebugInfo({
            asset: currentTransaction?.asset,
            network: currentTransaction?.network,
            amount: currentTransaction?.amount,
            currency: currentTransaction?.paymentCurrency,
            errorMessage: errorMessage,
            debugMessage: 'Transaction failed during submission',
          });
          await openSupportEmail(debugInfo);
        },
        onCancelCallback: () => {
          // Just dismiss the alert
        }
      });
      console.error('Error submitting form:', error);
      setIsProcessingPayment(false);
    }
  }, [createOrder, router, currentUser, evmAddress, getNetworkNameFromDisplayName, getAssetSymbolFromName, signOut, currentTransaction]);

  // Phone verification sheet state
  const [showPhoneSheet, setShowPhoneSheet] = useState(false);
  const [pendingApplePayAmount, setPendingApplePayAmount] = useState<string | null>(null);

  // Core Apple Pay trigger — called after phone is verified
  const triggerApplePay = useCallback((amt: string) => {
    const walletAddr = address || getCurrentWalletAddress() || connectedAddress;
    console.log('[StablePay] Triggering Apple Pay:', { amount: amt, address: walletAddr });
    if (!walletAddr) {
      console.error('[StablePay] No wallet address available');
      return;
    }
    handleSubmit({
      amount: amt,
      asset: 'USDC',
      network: 'Base',
      address: walletAddr,
      paymentMethod: 'GUEST_CHECKOUT_APPLE_PAY',
      paymentCurrency: 'USD',

    });
  }, [handleSubmit, address, connectedAddress]);

  // Apple Pay handler — checks phone verification first
  const handleFundTap = useCallback(async (amt: string) => {
    console.log('[StablePay] Bypassing quotes API — USDC/Base hardcoded, no quote needed');

    // Check cached phone verification
    const phoneRecord = await getPhoneRecord();

    if (!phoneRecord) {
      // No verified phone — show sheet first
      setPendingApplePayAmount(amt);
      setShowPhoneSheet(true);
      return;
    }

    console.log('[StablePay] Phone verified, proceeding:', {
      phoneNumber: phoneRecord.phoneNumber,
      expiresAt: new Date(phoneRecord.expiresAt).toISOString(),
    });

    triggerApplePay(amt);
  }, [triggerApplePay]);

  // Called when phone sheet completes verification
  const handlePhoneVerified = useCallback((phoneNumber: string) => {
    setShowPhoneSheet(false);
    console.log('[StablePay] Phone verified via sheet:', phoneNumber);

    if (pendingApplePayAmount) {
      const amt = pendingApplePayAmount;
      setPendingApplePayAmount(null);
      // Small delay to let sheet close smoothly
      setTimeout(() => {
        triggerApplePay(amt);
      }, 400);
    }
  }, [pendingApplePayAmount, triggerApplePay]);

  useEffect(() => {
    seedDemoContacts().then(() => {
      getContacts().then(setContacts);
    });
  }, []);

  // USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 6 decimals
  const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const USDC_DECIMALS = 6;

  const handleSendUsdc = useCallback(async () => {
    if (!selectedContact || !sendAmount) return;

    const amountNum = parseFloat(sendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSendError('Enter a valid amount');
      return;
    }

    // Get smart account address for sending
    const smartAccount = currentUser?.evmSmartAccounts?.[0] as string;
    if (!smartAccount) {
      setSendError('Wallet not ready — please wait');
      return;
    }

    // Record as pending in activity
    const activityItem = await addActivity({
      type: 'send',
      amountUsd: amountNum.toFixed(2),
      amountUsdc: amountNum.toFixed(2),
      status: 'pending',
      recipientName: selectedContact.name,
      recipientAddress: selectedContact.address,
    });

    console.log('[StablePay] Sending USDC onchain:', {
      from: smartAccount,
      to: selectedContact.address,
      amount: sendAmount,
      contract: USDC_BASE_ADDRESS,
    });

    try {
      // ERC-20 transfer: transfer(address,uint256)
      const transferSelector = '0xa9059cbb';
      const encodedRecipient = selectedContact.address.slice(2).padStart(64, '0');
      const amountRaw = BigInt(Math.floor(amountNum * Math.pow(10, USDC_DECIMALS)));
      const encodedAmount = amountRaw.toString(16).padStart(64, '0');
      const calldata = `${transferSelector}${encodedRecipient}${encodedAmount}` as `0x${string}`;

      const result = await sendUserOperation({
        evmSmartAccount: smartAccount as `0x${string}`,
        network: 'base' as any,
        calls: [{
          to: USDC_BASE_ADDRESS as `0x${string}`,
          value: 0n,
          data: calldata,
        }],
        useCdpPaymaster: true, // Gasless USDC on Base
      });

      console.log('[StablePay] UserOp submitted:', result);

      // Update activity with tx hash
      const { updateActivityStatus } = await import('../../utils/activity');
      await updateActivityStatus(
        activityItem.id,
        'confirmed',
        result.transactionHash || result.userOperationHash
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form
      setSelectedContact(null);
      setSendAmount('');
      setSendError(null);

      // Refresh balance
      fetchBalance();

    } catch (error: any) {
      console.error('[StablePay] Send failed:', error);
      const { updateActivityStatus } = await import('../../utils/activity');
      await updateActivityStatus(activityItem.id, 'failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error; // Let ConfirmSendSheet display the error
    }
  }, [selectedContact, sendAmount, currentUser, sendUserOperation, fetchBalance]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]} keyboardShouldPersistTaps="handled" bounces contentInsetAdjustmentBehavior="automatic">
        {/* Header */}
        <View style={styles.headerRow}>
          <Wordmark />
          <AnimatedPressable
            onPress={() => router.navigate('/(tabs)/profile')}
            scale={0.88}
            haptic="light"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: Paper.colors.navy,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: Paper.colors.background, fontSize: 15, fontWeight: '700' }}>
              {userInitial}
            </Text>
          </AnimatedPressable>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>GOOD MORNING</Text>

        {/* Balance */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(18).stiffness(200)} style={styles.balanceBlock}>
          {loadingBalance ? (
            <View style={styles.skeleton} />
          ) : (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceSup}>$</Text>
              <Text style={styles.balanceNumber}>
                {usdcBalance !== null ? usdcBalance.toFixed(2) : '0.00'}
              </Text>
            </View>
          )}
          <Text style={styles.balanceCaption}>USDC available to send</Text>
        </Animated.View>

        <View style={styles.divider} />

        {connectionError && (
          <Text style={styles.errorText}>{connectionError}</Text>
        )}

        {!hasBalance ? (
          /* STATE A — Zero balance */
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ADD FUNDS</Text>
            <Animated.View entering={FadeInDown.delay(200).springify().damping(18).stiffness(200)} style={styles.pillRow}>
              {quickAmounts.map((amt) => (
                <Pressable
                  key={amt}
                  style={[styles.pill, selectedQuickAmount === amt && styles.pillSelected]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedQuickAmount(amt); setAmount(amt); }}
                >
                  <Text style={[styles.pillText, selectedQuickAmount === amt && styles.pillTextSelected]}>
                    ${amt}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
            <AnimatedPressable
              style={styles.ctaButton}
              onPress={() => handleFundTap(selectedQuickAmount)}
              disabled={isProcessingPayment || loadingBalance || !walletReady}
              haptic="medium"
            >
              <Text style={styles.ctaText}>
                {!walletReady ? 'Creating wallet...' : isProcessingPayment ? 'Processing...' : 'Add with Apple Pay'}
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* STATE B — Has balance */
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SEND TO</Text>
              <ContactPicker
                contacts={contacts}
                selectedId={selectedContact?.id ?? null}
                onSelect={(c) => { setSelectedContact(c); setSendError(null); }}
                onAddNew={() => setShowAddContact(true)}
              />
            </View>

            {selectedContact && (
              <View style={[styles.card, { marginTop: 0 }]}>
                <Text style={styles.cardLabel}>AMOUNT</Text>
                <View style={styles.amountRow}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: Paper.colors.sand, marginRight: 4 }}>$</Text>
                  <TextInput
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    placeholder="0.00"
                    placeholderTextColor={Paper.colors.sandLight}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />
                  <Text style={styles.amountCurrency}>USDC</Text>
                </View>
                <View style={{ height: 2, backgroundColor: sendAmount.length > 0 ? Paper.colors.orange : Paper.colors.border, marginBottom: 4 }} />
              </View>
            )}

            <AnimatedPressable
              style={[styles.ctaButton, styles.ctaMargin]}
              onPress={() => setShowConfirm(true)}
              disabled={!selectedContact || !sendAmount || parseFloat(sendAmount) <= 0}
              haptic="medium"
            >
              <Text style={styles.ctaText}>
                {selectedContact ? `Send to ${selectedContact.name}` : 'Select a contact'}
              </Text>
            </AnimatedPressable>

            {sendError && <Text style={styles.errorText}>{sendError}</Text>}

            {usdcBalance !== null && sendAmount && parseFloat(sendAmount) > usdcBalance && (
              <Text style={styles.errorText}>Insufficient balance</Text>
            )}

            <AnimatedPressable
              style={styles.secondaryButton}
              onPress={() => handleFundTap('25')}
              disabled={isProcessingPayment}
              haptic="light"
            >
              <Text style={styles.secondaryText}>+ Fund wallet with Apple Pay</Text>
            </AnimatedPressable>
          </>
        )}
      </ScrollView>

      {/* Hidden OnrampForm - manages internal state the hooks depend on */}
      <View style={{ height: 0, overflow: 'hidden' }}>
        <OnrampForm
          address={address}
          onAddressChange={(newAddress) => {
            setAddress(newAddress);
            setConnectedAddress(newAddress);
          }}
          onSubmit={handleSubmit}
          isLoading={isProcessingPayment}
          options={options}
          isLoadingOptions={isLoadingOptions}
          getAvailableNetworks={getAvailableNetworks}
          getAvailableAssets={getAvailableAssets}
          paymentCurrencies={paymentCurrencies}
          amount={amount}
          onAmountChange={setAmount}
          buyConfig={buyConfig}
        />
      </View>

      {guestCheckoutVisible && activePaymentMethod && (
        <APIGuestCheckoutWidget
          paymentUrl={hostedUrl}
          paymentMethod={activePaymentMethod as 'GUEST_CHECKOUT_APPLE_PAY'}
          onClose={closeGuestCheckout}
          setIsProcessingPayment={setIsProcessingPayment}
          isSandbox={isSandboxOrder}
          onAlert={(title, message, type) => {
            let enhancedMessage = message;
            if (currentTransaction) {
              const txDetails = `\n\n${currentTransaction.amount} ${currentTransaction.paymentCurrency} → ${currentTransaction.asset} (${currentTransaction.network})`;
              enhancedMessage = message + txDetails;
            }
            setApplePayAlert({ visible: true, title, message: enhancedMessage, type });
          }}
        />
      )}
      {/* OnrampForm Alert - Wallet Connection (Always Success) */}
      <CoinbaseAlert
        visible={showAlert}
        title="Success"
        message={alertMessage}
        onConfirm={() => setShowAlert(false)}
      />
      {/* Guest Checkout Alert */}
      <CoinbaseAlert
        visible={applePayAlert.visible}
        title={applePayAlert.title}
        message={applePayAlert.message}
        type={applePayAlert.type}
        confirmText={applePayAlert.confirmText}
        cancelText={applePayAlert.cancelText || "Dismiss"}
        onConfirm={async () => {
          const navPath = applePayAlert.navigationPath;
          const callback = applePayAlert.onConfirmCallback;
          setApplePayAlert({ visible: false, title: '', message: '', type: 'info', navigationPath: undefined, onConfirmCallback: undefined, onCancelCallback: undefined, confirmText: undefined, cancelText: undefined });

          // Clear transaction details after alert is dismissed
          setCurrentTransaction(null);

          // Execute callback if it exists (e.g., sign out + navigate for re-verify)
          if (callback) {
            await callback();
          }
          // Otherwise navigate if path is provided (e.g., link phone/email)
          else if (navPath) {
            router.push(navPath as any);
          }
        }}
        onCancel={applePayAlert.onCancelCallback ? () => {
          const cancelCallback = applePayAlert.onCancelCallback;
          setApplePayAlert({ visible: false, title: '', message: '', type: 'info', navigationPath: undefined, onConfirmCallback: undefined, onCancelCallback: undefined, confirmText: undefined, cancelText: undefined });

          // Clear transaction details after alert is dismissed
          setCurrentTransaction(null);

          // Execute cancel callback if it exists
          if (cancelCallback) {
            cancelCallback();
          }
        } : undefined}
      />

      {/* Phone Verification Sheet */}
      <PhoneVerificationSheet
        visible={showPhoneSheet}
        onVerified={handlePhoneVerified}
        onDismiss={() => {
          setShowPhoneSheet(false);
          setPendingApplePayAmount(null);
        }}
      />

      <AddContactSheet
        visible={showAddContact}
        onSaved={(contact) => {
          setContacts(prev => [...prev, contact]);
          setSelectedContact(contact);
          setShowAddContact(false);
        }}
        onDismiss={() => setShowAddContact(false)}
      />

      <ConfirmSendSheet
        visible={showConfirm}
        contact={selectedContact}
        amountUsd={sendAmount}
        onConfirm={handleSendUsdc}
        onDismiss={() => setShowConfirm(false)}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Paper.colors.background },
  scrollContent: { paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Paper.colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: Paper.colors.background },
  greeting: { ...Paper.type.label, color: Paper.colors.sand, textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 20 },
  balanceBlock: { paddingHorizontal: 20, marginTop: 8, marginBottom: 24, alignItems: 'center' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  balanceSup: { ...Paper.type.balanceSup, color: Paper.colors.sand, marginTop: 8 },
  balanceNumber: { ...Paper.type.balanceLarge, color: Paper.colors.navy },
  balanceCaption: { ...Paper.type.caption, color: Paper.colors.sand, marginTop: 4 },
  skeleton: { width: 160, height: 52, backgroundColor: Paper.colors.border, borderRadius: 8, opacity: 0.6 },
  divider: { height: 1, backgroundColor: Paper.colors.border, marginHorizontal: 20, marginBottom: 24 },
  errorText: { fontSize: 12, color: Paper.colors.error, textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 },
  card: { backgroundColor: Paper.colors.white, borderRadius: Paper.radius.lg, marginHorizontal: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardLabel: { ...Paper.type.label, color: Paper.colors.sand, textTransform: 'uppercase', marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { flex: 1, height: 40, borderRadius: Paper.radius.full, backgroundColor: Paper.colors.surface, alignItems: 'center', justifyContent: 'center' },
  pillSelected: { borderWidth: 1.5, borderColor: Paper.colors.orange, backgroundColor: Paper.colors.orangeLight },
  pillText: { fontSize: 14, fontWeight: '600', color: Paper.colors.navy },
  pillTextSelected: { color: Paper.colors.orange, fontWeight: '700' },
  ctaButton: { backgroundColor: Paper.colors.orange, height: 54, borderRadius: Paper.radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaMargin: { marginHorizontal: 16, marginBottom: 10 },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: Paper.colors.white, fontSize: 15, fontWeight: '700' },
  addressInput: { fontSize: 14, color: Paper.colors.navy, borderWidth: 1, borderColor: Paper.colors.border, borderRadius: Paper.radius.sm, padding: 12, marginBottom: 12, backgroundColor: Paper.colors.surfaceWarm },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Paper.colors.surfaceWarm, borderWidth: 1, borderColor: Paper.colors.border, borderRadius: Paper.radius.sm, padding: 12, paddingHorizontal: 14 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: Paper.colors.navy, letterSpacing: -1 },
  amountCurrency: { fontSize: 13, fontWeight: '600', color: Paper.colors.sand },
  secondaryButton: { backgroundColor: Paper.colors.white, borderWidth: 1, borderColor: Paper.colors.border, height: 48, borderRadius: Paper.radius.md, marginHorizontal: 16, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600', color: Paper.colors.navy },
});

