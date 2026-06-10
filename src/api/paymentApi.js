/**
 * BarberUp V2 — Payment URL generators for Click & Payme (Uzbekistan).
 *
 * Reserved for future payment features.
 */

const CLICK_MERCHANT_ID = import.meta.env.VITE_CLICK_MERCHANT_ID ?? '';
const CLICK_SERVICE_ID = import.meta.env.VITE_CLICK_SERVICE_ID ?? '';
const PAYME_MERCHANT_ID = import.meta.env.VITE_PAYME_MERCHANT_ID ?? '';

export function getClickPaymentUrl({ amountUzs, orderId, returnUrl }) {
    const params = new URLSearchParams({
        service_id: CLICK_SERVICE_ID,
        merchant_id: CLICK_MERCHANT_ID,
        amount: String(amountUzs),
        transaction_param: orderId,
        return_url: returnUrl,
    });
    return `https://my.click.uz/services/pay?${params.toString()}`;
}

export function getPaymePaymentUrl({ amountUzs, orderId }) {
    const params = JSON.stringify({
        m: PAYME_MERCHANT_ID,
        ac: { order_id: orderId },
        a: amountUzs * 100,
        l: 'uz',
    });
    return `https://checkout.paycom.uz/${btoa(params)}`;
}
