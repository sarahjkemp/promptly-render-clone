/**
 * Angles-Specific QA Validation Module
 * Implements hard gate validation for enhanced angles format
 * Following ChatGPT's requirements for bullet format and statistical integration
 */

interface QAResult {
  pass: boolean;
  score: number;
  issues: string[];
  metrics: {
    angleCount: number;
    bulletCount: number;
    averageWordsPerBullet: number;
    statisticalContent: boolean;
  };
}

interface AngleData {
  headline: string;
  commentary: string;
  paragraph: string;
}

/**
 * 30-word regex pattern used in both QA and unit tests to avoid drift
 * Matches bullet points and counts words accurately
 */
const BULLET_WORD_COUNT_REGEX = /^•\s*(.+)$/;
const WORD_COUNT_REGEX = /\S+/g;

/**
 * Validates angles against enhanced format requirements
 * @param angles - Array of angle objects from AI generation
 * @returns QAResult with pass/fail and detailed analysis
 */
export function validateAngles(angles: AngleData[]): QAResult {
  const issues: string[] = [];
  let totalBullets = 0;
  let totalWords = 0;
  let hasStatisticalContent = false;

  // Check exact angle count (must be 3)
  if (angles.length !== 3) {
    issues.push(`Expected exactly 3 angles, got ${angles.length}`);
  }

  // Validate each angle
  angles.forEach((angle, i) => {
    const content = angle.commentary || angle.paragraph || '';
    
    // Check for bullet format
    const bulletLines = content.split('\n').filter(line => line.trim().startsWith('•'));
    
    if (bulletLines.length !== 3) {
      issues.push(`Angle ${i + 1}: Expected exactly 3 bullet points, got ${bulletLines.length}`);
    }

    // Validate each bullet point
    bulletLines.forEach((bullet, bulletIndex) => {
      const match = bullet.match(BULLET_WORD_COUNT_REGEX);
      if (match) {
        const bulletContent = match[1];
        const words = bulletContent.match(WORD_COUNT_REGEX) || [];
        const wordCount = words.length;
        
        totalBullets++;
        totalWords += wordCount;

        // Check 30-word limit
        if (wordCount > 30) {
          issues.push(`Angle ${i + 1}, Bullet ${bulletIndex + 1}: Exceeds 30 words (${wordCount})`);
        }

        // Check for statistical content in first bullet of each angle
        if (bulletIndex === 0 && !/\d|%|\$|£|€/.test(bulletContent)) {
          issues.push(`Angle ${i + 1}: First bullet should include statistics or numbers`);
        }

        // Check for statistical content overall
        if (/\d|%|\$|£|€/.test(bulletContent)) {
          hasStatisticalContent = true;
        }

        // Check for bold formatting
        if (!/\*\*.*?\*\*/.test(bulletContent)) {
          issues.push(`Angle ${i + 1}, Bullet ${bulletIndex + 1}: Missing bold opening verb (**word**)`);
        }
      } else {
        issues.push(`Angle ${i + 1}: Invalid bullet format - must start with • symbol`);
      }
    });

    // Check headline quality
    if (!angle.headline || angle.headline.length < 5) {
      issues.push(`Angle ${i + 1}: Headline too short or missing`);
    }

    const headlineWords = (angle.headline.match(WORD_COUNT_REGEX) || []).length;
    if (headlineWords < 5 || headlineWords > 15) {
      issues.push(`Angle ${i + 1}: Headline should be 5-15 words, got ${headlineWords}`);
    }
  });

  // Calculate metrics
  const averageWordsPerBullet = totalBullets > 0 ? totalWords / totalBullets : 0;

  const qaResult: QAResult = {
    pass: issues.length === 0,
    score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 15)), // 15 points per issue
    issues,
    metrics: {
      angleCount: angles.length,
      bulletCount: totalBullets,
      averageWordsPerBullet: Math.round(averageWordsPerBullet * 10) / 10,
      statisticalContent: hasStatisticalContent
    }
  };

  return qaResult;
}

/**
 * Logs QA results for monitoring and debugging
 * @param qaResult - Result from validateAngles function
 * @param articleId - Article ID for tracking
 */
export function logAnglesQA(qaResult: QAResult, articleId?: number): void {
  const logData = {
    articleId: articleId || 'unknown',
    timestamp: new Date().toISOString(),
    qaResult: {
      pass: qaResult.pass,
      score: qaResult.score,
      issueCount: qaResult.issues.length,
      metrics: qaResult.metrics
    }
  };

  if (qaResult.pass) {
    console.log('✅ Angles QA PASSED:', logData);
  } else {
    console.log('❌ Angles QA FAILED:', logData);
    console.log('🔍 Issues found:', qaResult.issues);
  }
}

/**
 * Creates user-friendly error message for QA failures
 * @param qaResult - Failed QA result
 * @returns Human-readable error message
 */
export function createAnglesQAErrorMessage(qaResult: QAResult): string {
  if (qaResult.pass) {
    return "Content validation passed";
  }

  const criticalIssues = qaResult.issues.filter(issue => 
    issue.includes('Expected exactly') || 
    issue.includes('Invalid bullet format') ||
    issue.includes('Missing bold opening')
  );

  if (criticalIssues.length > 0) {
    return "Angles need manual edit: Format issues detected. Please ensure exactly 3 angles with 3 bullet points each, starting with • and including **bold** opening verbs.";
  }

  return `Angles need manual edit: ${qaResult.issues.length} validation issues found. Please review content quality and format requirements.`;
}