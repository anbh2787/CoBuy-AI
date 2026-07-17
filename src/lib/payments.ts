import { User } from './types';

/**
 * Generates 1-click mobile deep links and web URLs for instant settlement payments.
 */
export function generatePaymentLinks(toUser: User, amount: number, groupTitle: string) {
  const note = encodeURIComponent(`Settling up right right for ${groupTitle} via CoBuy AI`);

  // UPI Deep Link (India - Google Pay, PhonePe, Paytm, etc.)
  let upiLink = '';
  if (toUser.paymentHandleUpi) {
    const vpa = encodeURIComponent(toUser.paymentHandleUpi);
    const name = encodeURIComponent(toUser.name);
    upiLink = `upi://pay?pa=${vpa}&pn=${name}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
  }

  // Venmo Deep Link / Web URL (US)
  let venmoLink = '';
  if (toUser.paymentHandleVenmo) {
    const handle = toUser.paymentHandleVenmo.replace(/^@/, '');
    venmoLink = `https://venmo.com/?txn=pay&recipients=${handle}&amount=${amount.toFixed(2)}&note=${note}`;
  }

  // PayPal URL
  const paypalLink = `https://paypal.me/${encodeURIComponent(toUser.name.toLowerCase().replace(/\s+/g, ''))}/${amount.toFixed(2)}`;

  return {
    upiLink,
    venmoLink,
    paypalLink,
  };
}
