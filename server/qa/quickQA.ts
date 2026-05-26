import { ArticleDraftV2 } from "../openaiSchemas";

/**
 * Quick QA validator that applies the rubric gates for content quality
 * Adapted to work with current article format while being ready for ArticleDraftV2
 */
export function quickQA(draft: any, industryHint: string) {
  // Handle both current format (title, content) and future ArticleDraftV2 format
  const isV2Format = draft.hook_stat && draft.stat_date && draft.word_count;
  
  let recencyOk = true;
  let wcOk = false;
  let linksOk = true; // Default to true since links come from media suggestions separately
  let industryOk = true;

  if (isV2Format) {
    // Full ArticleDraftV2 validation
    const now = Date.now();
    const ageDays = (now - new Date(draft.stat_date).getTime()) / 86_400_000;
    recencyOk = ageDays <= 180; // Extended to 6 months for better data availability
    wcOk = draft.word_count >= 600 && draft.word_count <= 800;
    
    const liveLinks = draft.links ? draft.links.filter((l: any) => l.is_alive) : [];
    linksOk = liveLinks.length >= 3;
  } else {
    // Current format validation - calculate word count from content
    if (draft.content) {
      const wordCount = draft.content.trim().split(/\s+/).filter((word: string) => word.length > 0).length;
      wcOk = wordCount >= 600 && wordCount <= 800;
    }
  }

  // Industry alignment check - look for industry keywords in available fields
  if (industryHint) {
    const indRx = new RegExp(industryHint, "i");
    industryOk = 
      (draft.content && indRx.test(draft.content)) ||
      (draft.title && indRx.test(draft.title)) ||
      (draft.hook_stat && indRx.test(draft.hook_stat));
  }

  const pass = recencyOk && wcOk && linksOk && industryOk;
  
  return { 
    pass, 
    recencyOk, 
    wcOk, 
    linksOk, 
    industryOk,
    details: {
      ageDays: isV2Format ? Math.round((Date.now() - new Date(draft.stat_date).getTime()) / 86_400_000) : null,
      wordCount: isV2Format ? draft.word_count : (draft.content ? draft.content.trim().split(/\s+/).filter((word: string) => word.length > 0).length : 0),
      liveLinksCount: draft.links ? draft.links.filter((l: any) => l.is_alive).length : 0,
      industryHint,
      format: isV2Format ? 'ArticleDraftV2' : 'current'
    }
  };
}