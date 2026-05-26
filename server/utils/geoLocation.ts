// @ts-ignore - no type definitions available for iso-3166-1-alpha-2
import isoLookup from "iso-3166-1-alpha-2";

type CompanyProfile = {
  targetRegions?: string[];
  industry?: string;
  name?: string;
  hqCountryIso?: string;
};

type LocationContext = {
  type: string;
  country?: string;
  region?: string;
};

// Region to country code mapping for geo-targeting
const REGION_TO_COUNTRY_MAP: Record<string, string> = {
  // Direct country codes
  "US": "US",
  "DE": "DE", 
  "GB": "GB",
  "FR": "FR",
  "CA": "CA",
  "AU": "AU",
  "SG": "SG",
  "JP": "JP",
  
  // Regional groupings
  "North America": "US",
  "United States": "US", 
  "Canada": "CA",
  "Europe": "GB",
  "United Kingdom": "GB",
  "Germany": "DE",
  "France": "FR",
  "Spain": "ES",
  "Italy": "IT",
  "Netherlands": "NL",
  "Belgium": "BE",
  "Switzerland": "CH",
  "Austria": "AT",
  "Sweden": "SE",
  "Norway": "NO",
  "Denmark": "DK",
  "Finland": "FI",
  
  // Special regions for testing
  "DACH": "DE", // Germany, Austria, Switzerland region
  "FinTech": "US", // FinTech hub (US)
  "HealthTech": "DE", // HealthTech hub (Germany)
  
  // Asia Pacific
  "Asia Pacific": "SG",
  "Australia": "AU",
  "New Zealand": "NZ",
  "Singapore": "SG",
  "Japan": "JP",
  "South Korea": "KR",
  "Hong Kong": "HK",
  "India": "IN",
  "China": "CN"
};

export function getUserLocation(profile: any): LocationContext | undefined {
  const region = profile?.targetRegions?.[0]?.trim();
  
  // First try direct lookup from our mapping
  if (region && REGION_TO_COUNTRY_MAP[region]) {
    return { type: "approximate", country: REGION_TO_COUNTRY_MAP[region], region };
  }
  
  // Fallback to iso lookup
  const iso = region && isoLookup.getCountry(region);
  if (iso) return { type: "approximate", country: iso, region };
  
  if (profile?.hqCountryIso) return { type: "approximate", country: profile.hqCountryIso, region: profile.hqCountryIso };
  return undefined;        // fallback → global search
}

/**
 * Generates industry-specific search bias for OpenAI prompts
 * Implements ChatGPT consultation recommendations for industry targeting
 * 
 * @param industry Raw industry string from company profile
 * @returns Formatted industry bias string for prompt injection
 */
export function generateIndustryBias(industry?: string): string {
  if (!industry || industry.trim() === '') {
    return '';
  }
  
  const cleanIndustry = industry.trim();
  return `Focus on authoritative ${cleanIndustry} trade publications and analysts.`;
}

/**
 * Enhanced search prompt builder with geographic and industry context
 * Replaces hardcoded UK bias with dynamic company-specific targeting
 * 
 * @param basePrompt The base search prompt
 * @param profile Company profile for context derivation
 * @returns Enhanced prompt with geographic and industry bias
 */
export function enhanceSearchPrompt(basePrompt: string, profile: CompanyProfile): {
  prompt: string;
  userLocation?: LocationContext;
} {
  const industryBias = generateIndustryBias(profile?.name ? 
    `industry context for ${profile.name}` : undefined
  );
  
  const enhancedPrompt = industryBias 
    ? `${industryBias}\n${basePrompt}`
    : basePrompt;
    
  const userLocation = getUserLocation(profile);
  
  return {
    prompt: enhancedPrompt,
    userLocation
  };
}

/**
 * Validates that a location context is properly formatted
 * @param location Location context to validate
 * @returns Boolean indicating if location is valid
 */
export function isValidLocationContext(location?: LocationContext): boolean {
  if (!location) return false;
  
  // Validate country code format (2-letter ISO)
  if (!location.country || location.country.length !== 2) return false;
  
  // Validate region is not empty
  if (!location.region || location.region.trim() === '') return false;
  
  return true;
}

/**
 * Get supported regions for UI display
 * @returns Array of supported regional identifiers
 */
export function getSupportedRegions(): string[] {
  return Object.keys(REGION_TO_COUNTRY_MAP).filter(key => 
    REGION_TO_COUNTRY_MAP[key] !== undefined
  ).sort();
}