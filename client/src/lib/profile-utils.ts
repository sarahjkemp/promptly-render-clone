import { CompanyProfile } from "@shared/schema";

// Profile completeness utility functions
export interface ProfileCompleteness {
  score: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  missingFields: string[];
}

export function getProfileCompleteness(profile: CompanyProfile | null | undefined): ProfileCompleteness {
  if (!profile) {
    return {
      score: 0,
      total: 4,
      percentage: 0,
      isComplete: false,
      missingFields: ['Industry', 'Tone', 'Target Regions', 'Keywords']
    };
  }

  const requiredFields = [
    { key: 'industry', label: 'Industry', value: profile.industry || profile.industryCustom },
    { key: 'tone', label: 'Tone', value: profile.tone },
    { key: 'targetRegions', label: 'Target Regions', value: profile.targetRegions && profile.targetRegions.length > 0 },
    { key: 'keywords', label: 'Keywords', value: profile.keywords && profile.keywords.length > 0 }
  ];

  const completedFields = requiredFields.filter(field => field.value);
  const missingFields = requiredFields.filter(field => !field.value).map(field => field.label);

  const score = completedFields.length;
  const total = requiredFields.length;
  const percentage = Math.round((score / total) * 100);
  const isComplete = score === total;

  return {
    score,
    total,
    percentage,
    isComplete,
    missingFields
  };
}

export function getProfileBadgeVariant(completeness: ProfileCompleteness): 'secondary' | 'default' | 'success' {
  if (completeness.isComplete) return 'success';
  if (completeness.score >= 3) return 'default';
  return 'secondary';
}

export function getProfileBadgeText(completeness: ProfileCompleteness): string {
  return `${completeness.score}/${completeness.total} complete`;
}

export function getEffectiveIndustry(profile: CompanyProfile | null | undefined): string {
  if (!profile) return "General";
  return profile.industryCustom || profile.industry || "General";
}