export const PAKISTAN_PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu and Kashmir',
] as const;

export const PAKISTAN_CITIES = [
  'Abbottabad',
  'Attock',
  'Badin',
  'Bahawalnagar',
  'Bahawalpur',
  'Bannu',
  'Bhakkar',
  'Chakwal',
  'Chaman',
  'Charsadda',
  'Chiniot',
  'Chitral',
  'Dadu',
  'Dera Ghazi Khan',
  'Dera Ismail Khan',
  'Dera Murad Jamali',
  'Dir',
  'Faisalabad',
  'Ghotki',
  'Gilgit',
  'Gujranwala',
  'Gujrat',
  'Gwadar',
  'Hafizabad',
  'Hangu',
  'Haripur',
  'Hub',
  'Hunza',
  'Hyderabad',
  'Islamabad',
  'Jacobabad',
  'Jamshoro',
  'Jhang',
  'Jhelum',
  'Kandhkot',
  'Karachi',
  'Kashmore',
  'Kasur',
  'Khairpur',
  'Khanewal',
  'Khuzdar',
  'Kohat',
  'Kotli',
  'Lahore',
  'Lakki Marwat',
  'Larkana',
  'Layyah',
  'Lodhran',
  'Loralai',
  'Malakand',
  'Mandi Bahauddin',
  'Mansehra',
  'Mardan',
  'Mastung',
  'Matiari',
  'Mianwali',
  'Mingora',
  'Mirpur',
  'Mirpur Khas',
  'Mirpur Mathelo',
  'Multan',
  'Murree',
  'Muzaffarabad',
  'Muzaffargarh',
  'Nankana Sahib',
  'Narowal',
  'Naseerabad',
  'Naushahro Feroze',
  'Nawabshah',
  'Nowshera',
  'Okara',
  'Pakpattan',
  'Peshawar',
  'Quetta',
  'Rahim Yar Khan',
  'Rajanpur',
  'Rawalakot',
  'Rawalpindi',
  'Sahiwal',
  'Sanghar',
  'Sargodha',
  'Shaheed Benazirabad',
  'Sheikhupura',
  'Shikarpur',
  'Sialkot',
  'Sibi',
  'Skardu',
  'Sukkur',
  'Swabi',
  'Swat',
  'Tando Adam',
  'Tando Allahyar',
  'Tank',
  'Thatta',
  'Timergara',
  'Toba Tek Singh',
  'Turbat',
  'Umerkot',
  'Vehari',
  'Zhob',
] as const;

export type PakistanProvince = (typeof PAKISTAN_PROVINCES)[number];
export type PakistanCity = (typeof PAKISTAN_CITIES)[number];

export interface PakistanDeliveryAddressInput {
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
  shippingLatitude?: number | null;
  shippingLongitude?: number | null;
}

export type AddressValidationResult =
  | { ok: true }
  | { ok: false; message: string; path: keyof PakistanDeliveryAddressInput };

const provinceSet = new Set<string>(PAKISTAN_PROVINCES.map((p) => p.toLowerCase()));
const citySet = new Set<string>(PAKISTAN_CITIES.map((c) => c.toLowerCase()));

const PLACEHOLDER_RE = /\b(abc|asdf|fake|lorem|none|null|qwerty|sample|test|unknown|xyz)\b/i;
const FOREIGN_LOCATION_RE =
  /\b(america|australia|canada|california|delhi|dubai|england|france|germany|india|italy|london|new york|qatar|saudi|spain|toronto|uae|uk|united kingdom|usa)\b/i;
const ADDRESS_DETAIL_RE =
  /(\d|\b(apartment|area|bazar|bazaar|block|colony|flat|gali|house|landmark|lane|market|mohalla|near|opposite|phase|plaza|road|sector|shop|street|town|village)\b)/i;

export function isWithinPakistanBounds(latitude?: number | null, longitude?: number | null) {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return false;
  }

  return latitude >= 23.35 && latitude <= 37.1 && longitude >= 60.85 && longitude <= 77.1;
}

export function isPakistanCity(value?: string | null) {
  return !!value && citySet.has(value.trim().toLowerCase());
}

export function isPakistanProvince(value?: string | null) {
  return !!value && provinceSet.has(value.trim().toLowerCase());
}

export function validatePakistanDeliveryAddress(input: PakistanDeliveryAddressInput): AddressValidationResult {
  const address = input.shippingAddress?.trim() ?? '';
  const city = input.shippingCity?.trim() ?? '';
  const province = input.shippingProvince?.trim() ?? '';
  const postalCode = input.shippingPostalCode?.trim() ?? '';
  const hasLatitude = input.shippingLatitude !== undefined && input.shippingLatitude !== null;
  const hasLongitude = input.shippingLongitude !== undefined && input.shippingLongitude !== null;

  if (address.length < 12) {
    return {
      ok: false,
      message: 'Enter a complete house, street, area, or landmark for delivery',
      path: 'shippingAddress',
    };
  }

  if (address.length > 240) {
    return { ok: false, message: 'Delivery address is too long', path: 'shippingAddress' };
  }

  if (PLACEHOLDER_RE.test(address)) {
    return { ok: false, message: 'Enter a real delivery address', path: 'shippingAddress' };
  }

  if (FOREIGN_LOCATION_RE.test(`${address} ${city} ${province}`)) {
    return { ok: false, message: 'Orders can only be delivered inside Pakistan', path: 'shippingAddress' };
  }

  if (!ADDRESS_DETAIL_RE.test(address)) {
    return {
      ok: false,
      message: 'Add a house number, street, block, area, or nearby landmark',
      path: 'shippingAddress',
    };
  }

  if (!isPakistanCity(city)) {
    return { ok: false, message: 'Choose a valid Pakistan city or district', path: 'shippingCity' };
  }

  if (!isPakistanProvince(province)) {
    return { ok: false, message: 'Choose a valid Pakistan province or region', path: 'shippingProvince' };
  }

  if (postalCode && !/^\d{5}$/.test(postalCode)) {
    return { ok: false, message: 'Pakistan postal codes must be 5 digits', path: 'shippingPostalCode' };
  }

  if (hasLatitude !== hasLongitude) {
    return { ok: false, message: 'Send both latitude and longitude for live location', path: 'shippingLatitude' };
  }

  if (hasLatitude && !isWithinPakistanBounds(input.shippingLatitude, input.shippingLongitude)) {
    return { ok: false, message: 'Live location must be inside Pakistan', path: 'shippingLatitude' };
  }

  return { ok: true };
}

export function formatPakistanShippingAddress(input: PakistanDeliveryAddressInput) {
  const lines = [
    input.shippingAddress?.trim(),
    [input.shippingCity?.trim(), input.shippingProvince?.trim()].filter(Boolean).join(', '),
    input.shippingPostalCode?.trim() ? `Postal code: ${input.shippingPostalCode.trim()}` : undefined,
    input.shippingLatitude !== undefined &&
    input.shippingLatitude !== null &&
    input.shippingLongitude !== undefined &&
    input.shippingLongitude !== null
      ? `Live location verified: ${input.shippingLatitude.toFixed(5)}, ${input.shippingLongitude.toFixed(5)}`
      : undefined,
    'Pakistan',
  ].filter((line): line is string => !!line);

  return lines.join('\n');
}
