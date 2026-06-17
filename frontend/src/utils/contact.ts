// Tick Worth's real contact details — single source of truth for the footer,
// the floating WhatsApp button, and anywhere else we surface contact info.
const WHATSAPP_NUMBER = '923132538058'; // +92 313 2538058 in wa.me format (no +, spaces)

export const CONTACT = {
  phoneDisplay: '+92 313 2538058',
  // EasyPaisa account the customer pays for online orders.
  easypaisaNumber: '+92 315 8323049',
  // Pre-fills a friendly message when the chat opens.
  whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Hi Tick Worth! I'm interested in one of your timepieces.",
  )}`,
  instagramUrl: 'https://www.instagram.com/tick.worth?igsh=M3N6djBobTRlaGpx',
  instagramHandle: '@tick.worth',
  facebookUrl: 'https://www.facebook.com/share/1A7yGqWAGT',
  facebookHandle: 'Tick Worth',
};
