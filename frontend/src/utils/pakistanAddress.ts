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

export interface PakistanAddressDraft {
  address: string;
  city: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

const citySet = new Set<string>(PAKISTAN_CITIES.map((c) => c.toLowerCase()));
const provinceSet = new Set<string>(PAKISTAN_PROVINCES.map((p) => p.toLowerCase()));

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

export function validatePakistanAddressDraft(draft: PakistanAddressDraft) {
  const address = draft.address.trim();
  const city = draft.city.trim();
  const province = draft.province.trim();
  const postalCode = draft.postalCode?.trim() ?? '';

  if (address.length < 12) return 'Enter a complete house, street, area, or landmark for delivery';
  if (PLACEHOLDER_RE.test(address)) return 'Enter a real delivery address';
  if (FOREIGN_LOCATION_RE.test(`${address} ${city} ${province}`)) {
    return 'Orders can only be delivered inside Pakistan';
  }
  if (!ADDRESS_DETAIL_RE.test(address)) {
    return 'Add a house number, street, block, area, or nearby landmark';
  }
  if (!citySet.has(city.toLowerCase())) return 'Choose a valid Pakistan city or district';
  if (!provinceSet.has(province.toLowerCase())) return 'Choose a valid Pakistan province or region';
  if (postalCode && !/^\d{5}$/.test(postalCode)) return 'Pakistan postal codes must be 5 digits';

  const hasLatitude = draft.latitude !== undefined;
  const hasLongitude = draft.longitude !== undefined;
  if (hasLatitude !== hasLongitude) return 'Live location needs both latitude and longitude';
  if (hasLatitude && !isWithinPakistanBounds(draft.latitude, draft.longitude)) {
    return 'Live location must be inside Pakistan';
  }

  return null;
}
