/**
 * Simple LinkedIn formatter for PR content
 */
export function buildLinkedIn({ hook, bullets, cta }: {
  hook: string; 
  bullets: string[]; 
  cta: string;
}): string {
  return `${hook}\n\n${bullets.map(b => `• ${b}`).join('\n')}\n\n${cta}`;
}