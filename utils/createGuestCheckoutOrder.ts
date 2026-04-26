import { BASE_URL } from "../constants/BASE_URL";
import { authenticatedFetch } from "./authenticatedFetch";

/**
 * Pattern used across all API utilities:
 * 1. Enhanced request logging (method, headers, body preview)
 * 2. Response cloning for safe logging
 * 3. Proper error re-throwing for UI handling
 * 4. Test mode: Server handles TestFlight tokens appropriately
 */

export async function createGuestCheckoutOrder(payload: any) {
  try {
    const method = payload.paymentMethod?.includes('GOOGLE') ? 'Google Pay' : 'Apple Pay';
    console.log(`📤 [API] createGuestCheckoutOrder (${method})`);

    // Field-level logging for debugging API errors
    console.log('[StablePay] createGuestCheckoutOrder fields:');
    console.log('  paymentAmount:', JSON.stringify(payload.paymentAmount));
    console.log('  paymentCurrency:', JSON.stringify(payload.paymentCurrency));
    console.log('  purchaseCurrency:', JSON.stringify(payload.purchaseCurrency));
    console.log('  paymentMethod:', JSON.stringify(payload.paymentMethod));
    console.log('  destinationNetwork:', JSON.stringify(payload.destinationNetwork));
    console.log('  destinationAddress:', JSON.stringify(payload.destinationAddress));
    console.log('  email:', JSON.stringify(payload.email));
    console.log('  phoneNumber:', JSON.stringify(payload.phoneNumber));
    console.log('  partnerUserRef:', JSON.stringify(payload.partnerUserRef));

    // Validate all required string fields before hitting API
    const requiredStringFields: Record<string, any> = {
      paymentAmount: payload.paymentAmount,
      paymentCurrency: payload.paymentCurrency,
      purchaseCurrency: payload.purchaseCurrency,
      paymentMethod: payload.paymentMethod,
      destinationNetwork: payload.destinationNetwork,
      destinationAddress: payload.destinationAddress,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      partnerUserRef: payload.partnerUserRef,
    };

    for (const [fieldName, fieldValue] of Object.entries(requiredStringFields)) {
      if (typeof fieldValue !== 'string' || fieldValue.length === 0) {
        throw new Error(
          `[StablePay] createGuestCheckoutOrder: field "${fieldName}" is invalid: ${JSON.stringify(fieldValue)}`
        );
      }
    }

    const response = await authenticatedFetch(`${BASE_URL}/server/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://api.cdp.coinbase.com/platform/v2/onramp/orders",
        method: "POST",
        body: payload
      })
    });

    console.log('📥 [RESPONSE] Status:', response.status, response.statusText);
    console.log('📥 [RESPONSE] Headers:', {
      'content-type': response.headers.get('content-type'),
      'x-request-id': response.headers.get('x-request-id')
    });

    // Log response
    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => '<non-text body>');

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorType = errorData?.errorType || '';
      const errorMessage = errorData?.errorMessage || '';

      // Check if this is a quote request with limit error - use console.log instead of console.error
      const isQuoteRequest = payload.isQuote === true;
      const isLimitError = errorType === 'guest_transaction_limit' || errorMessage.includes('exceed');

      if (isQuoteRequest && isLimitError) {
        console.log('⚠️  [QUOTE] Request blocked by user limits (expected behavior)');
        console.log('⚠️  [QUOTE] Status:', response.status);
        console.log('⚠️  [QUOTE] Message:', errorMessage);
      } else {
        console.error('❌ [RESPONSE] Request failed!');
        console.error('❌ [RESPONSE] Status:', response.status);
        console.error('❌ [RESPONSE] Body:', responseText);
      }

      const fullErrorMessage = errorMessage
        ? `${errorType}: ${errorMessage}`
        : errorData?.message || `HTTP error! status: ${response.status}`;
      throw new Error(fullErrorMessage);
    }

    console.log('✅ [RESPONSE] Request succeeded!');

    const responseJson = await response.json();
    console.log('responseJson', responseJson);

    // Return the hosted URL from Coinbase response
    return {
      ...responseJson,
      hostedUrl: responseJson.paymentLink?.url, 
      orderId: responseJson.order?.orderId
    };
  } catch (error) {
    throw error;
  }
}

