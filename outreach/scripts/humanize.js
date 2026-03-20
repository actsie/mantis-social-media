#!/usr/bin/env node
/**
 * humanize.js
 * Standalone humanizer CLI — converts AI writing to human writing.
 * Direct implementation of skills/humanizer/SKILL.md rules (regex-based).
 * 
 * Usage:
 *   node outreach/scripts/humanize.js --input draft.txt --output humanized.txt
 */

const fs = require('fs');

// Parse arguments
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const outputIdx = args.indexOf('--output');

if (inputIdx === -1 || outputIdx === -1) {
  console.error('Usage: node humanize.js --input <draft.txt> --output <humanized.txt>');
  process.exit(1);
}

const inputPath = args[inputIdx + 1];
const outputPath = args[outputIdx + 1];

// Read draft
if (!fs.existsSync(inputPath)) {
  console.error(`Draft file not found: ${inputPath}`);
  process.exit(1);
}

const draft = fs.readFileSync(inputPath, 'utf8').trim();
console.log(`\n📝 Humanizing draft:\n"${draft}"\n`);

let humanized = draft;
const changes = [];

// === LANGUAGE PATTERNS (from SKILL.md) ===

// 1. AI Vocabulary Words (Section 7)
const aiWords = {
  // Remove entirely
  'additionally': '',
  'crucial': '',
  'delve': '',
  'emphasizing': '',
  'enduring': '',
  'fostering': '',
  'garner': '',
  'highlight': '',
  'highlighting': '',
  'interplay': '',
  'intricate': '',
  'intricacies': '',
  'key': '',
  'landscape': '',
  'pivotal': '',
  'showcase': '',
  'showcasing': '',
  'tapestry': '',
  'testament': '',
  'underscore': '',
  'underscoring': '',
  'valuable': '',
  'vibrant': '',
  'genuinely': '',
  'actually': '',
  'especially': '',
  'weird': '',
  'resonate': '',
  'resonates': '',
  'resonated': '',
  'nightmare': '',
  'quiet': '',
  'plot twist': '',
  'lands': '',
  'stick': '',
  'sticks': '',
  'click': 'works',
  'clicks': 'works',
  'reads': '',
  'read': '',
  'clean': '',
  'bingo card': '',
  'frame': '',
  'framing': '',
  'vibe': 'feel',
  'vibes': 'feels',
  
  // Replace with simpler alternatives
  'amazing': 'great',
  'stunning': 'great',
  'profound': 'deep',
  'groundbreaking': 'new',
  'renowned': 'known',
  'breathtaking': 'great',
  'enhance': 'improve',
  'enhancing': 'improving',
  'foster': 'build',
  'cultivate': 'build',
  'exemplifies': 'shows',
  'boasts': 'has',
  'features': 'has',
  'offers': 'has',
  'serves as': 'is',
  'stands as': 'is',
  'marks': 'is',
  'represents': 'is',
  'symbolizing': 'showing',
  'reflecting': 'showing',
  'contributing to': 'helping',
  'setting the stage for': 'preparing for',
  'evolving landscape': 'changing world',
  'focal point': 'focus',
  'indelible mark': 'mark',
  'deeply rooted': 'rooted',
  'significant': 'big',
  'significance': 'importance',
  'vital': 'important',
  'critical': 'important',
  'essential': 'important',
  'fundamental': 'basic',
  'comprehensive': 'full',
  'extensive': 'large',
  'substantial': 'big',
  'considerable': 'big',
  'notable': 'noteworthy',
  'remarkable': 'noteworthy',
  'extraordinary': 'unusual',
  'exceptional': 'unusual',
  'outstanding': 'great',
  'superb': 'great',
  'excellent': 'great',
  'fantastic': 'great',
  'wonderful': 'great',
  'marvelous': 'great',
  'terrific': 'great',
  'fabulous': 'great',
  'incredible': 'unbelievable',
  'unbelievable': 'hard to believe',
  'undeniably': '',
  'undoubtedly': '',
  'certainly': '',
  'absolutely': '',
  'definitely': '',
  'truly': '',
  'really': '',
  'very': '',
  'so': '',
  'such a': 'a',
  'quite': '',
  'rather': '',
  'somewhat': '',
  'slightly': '',
  'marginally': '',
  'minimally': '',
  'barely': '',
  'hardly': '',
  'scarcely': '',
  'nearly': '',
  'almost': '',
  'practically': '',
  'virtually': '',
  'essentially': '',
  'basically': '',
  'fundamentally': '',
  'primarily': '',
  'mainly': '',
  'mostly': '',
  'largely': '',
  'generally': '',
  'typically': '',
  'usually': '',
  'commonly': '',
  'frequently': '',
  'often': '',
  'regularly': '',
  'consistently': '',
  'constantly': '',
  'continuously': '',
  'persistently': '',
  'repeatedly': '',
  'consistently': '',
  'in order to': 'to',
  'due to the fact that': 'because',
  'at this point in time': 'now',
  'in the event that': 'if',
  'has the ability to': 'can',
  'it is important to note that': '',
  'it should be noted that': '',
  'it is worth noting that': '',
  'in conclusion': '',
  'to summarize': '',
  'to conclude': '',
  'in summary': '',
  'overall': '',
  'in order to achieve this goal': 'to do this',
  'based on available information': '',
  'while specific details are limited': '',
  'up to my last training update': '',
  'as of': '',
  'i hope this helps': '',
  'of course': '',
  'certainly': '',
  'you are absolutely right': '',
  'would you like': '',
  'let me know': '',
  'here is a': 'here is',
  'great question': '',
  'excellent point': 'good point',
  'that is an excellent point': 'good point',
  'this is a complex topic': 'this is complicated',
  'the economic factors you mentioned': 'the economics you mentioned',
};

Object.entries(aiWords).forEach(([word, replacement]) => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  if (regex.test(humanized)) {
    humanized = humanized.replace(regex, replacement);
    if (replacement) {
      changes.push(`"${word}" → "${replacement}"`);
    } else {
      changes.push(`Removed "${word}"`);
    }
  }
});

// 2. Em dashes → periods (Section 13)
if (humanized.includes('—')) {
  humanized = humanized.replace(/—/g, '. ');
  changes.push('Em dashes → periods');
}

// 3. Hyphens used as dashes → periods
if (humanized.includes(' - ')) {
  humanized = humanized.replace(/ - /g, '. ');
  changes.push('Hyphens → periods');
}

// 4. Quotation marks → remove (Section 18)
// Only remove curly quotes, NOT apostrophes in contractions
if (humanized.includes('"') || humanized.includes('"')) {
  humanized = humanized.replace(/[""]/g, '');
  changes.push('Removed curly quotation marks');
}

// 5. Negative parallelisms (Section 9) - SKIPPED
// This requires full sentence rewriting, not just word replacement
// Example from skill: "It's not just about X; it's Y" → "The X does Y"
// This is beyond simple regex replacement - would need LLM

// 6. Promotional language (Section 4)
const promoWords = {
  'must-visit': 'worth visiting',
  'must-have': 'worth having',
  'must-see': 'worth seeing',
  'game-changer': 'helpful',
  'game changing': 'helpful',
  'next-level': 'great',
  'next level': 'great',
  'total': '',
  'perfect': 'great',
  'flawless': 'great',
  'nestled': 'located',
  'in the heart of': 'in',
  'boasts a': 'has a',
  'boasts an': 'has an',
  'boasts': 'has',
  'rich cultural heritage': 'history',
  'natural beauty': 'scenery',
  'stunning natural beauty': 'scenery',
  'breathtaking region': 'region',
  'vibrant town': 'town',
};

Object.entries(promoWords).forEach(([word, replacement]) => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  if (regex.test(humanized)) {
    humanized = humanized.replace(regex, replacement);
    changes.push(`"${word}" → "${replacement}"`);
  }
});

// 7. -ing endings that add fake depth (Section 3)
const ingPatterns = [
  { pattern: /\bhighlighting\b/gi, replacement: 'it shows' },
  { pattern: /\bunderscoring\b/gi, replacement: 'it shows' },
  { pattern: /\bemphasizing\b/gi, replacement: 'it shows' },
  { pattern: /\bensuring\b/gi, replacement: 'making sure' },
  { pattern: /\breflecting\b/gi, replacement: 'showing' },
  { pattern: /\bsymbolizing\b/gi, replacement: 'showing' },
  { pattern: /\bcontributing to\b/gi, replacement: 'helping' },
  { pattern: /\bcultivating\b/gi, replacement: 'building' },
  { pattern: /\bfostering\b/gi, replacement: 'building' },
  { pattern: /\bencompassing\b/gi, replacement: 'including' },
  { pattern: /\bshowcasing\b/gi, replacement: 'showing' },
];

ingPatterns.forEach(({ pattern, replacement }) => {
  if (pattern.test(humanized)) {
    humanized = humanized.replace(pattern, replacement);
    changes.push(`Removed -ing filler`);
  }
});

// 8. Rule of three (Section 10) - simplify lists of 3
// This is hard to do programmatically, so we skip it

// 9. Filler phrases (Section 22)
const fillerPhrases = [
  { pattern: /in order to/gi, replacement: 'to' },
  { pattern: /due to the fact that/gi, replacement: 'because' },
  { pattern: /at this point in time/gi, replacement: 'now' },
  { pattern: /in the event that/gi, replacement: 'if' },
  { pattern: /has the ability to/gi, replacement: 'can' },
  { pattern: /it is important to note that/gi, replacement: '' },
  { pattern: /it should be noted that/gi, replacement: '' },
  { pattern: /it is worth noting that/gi, replacement: '' },
  { pattern: /in conclusion/gi, replacement: '' },
  { pattern: /to summarize/gi, replacement: '' },
  { pattern: /to conclude/gi, replacement: '' },
  { pattern: /in summary/gi, replacement: '' },
  { pattern: /overall/gi, replacement: '' },
  { pattern: /based on available information/gi, replacement: '' },
  { pattern: /while specific details are limited/gi, replacement: '' },
  { pattern: /up to my last training update/gi, replacement: '' },
  { pattern: /as of.*date/gi, replacement: '' },
  { pattern: /i hope this helps/gi, replacement: '' },
  { pattern: /of course/gi, replacement: '' },
  { pattern: /would you like/gi, replacement: 'do you want' },
  { pattern: /let me know/gi, replacement: 'tell me' },
  { pattern: /here is a/gi, replacement: 'here is' },
  { pattern: /great question/gi, replacement: '' },
  { pattern: /excellent point/gi, replacement: 'good point' },
];

fillerPhrases.forEach(({ pattern, replacement }) => {
  if (pattern.test(humanized)) {
    humanized = humanized.replace(pattern, replacement);
    changes.push('Removed filler phrase');
  }
});

// 10. Excessive hedging (Section 23)
const hedgingWords = {
  'could potentially': 'could',
  'possibly': '',
  'might': '',
  'may': '',
  'perhaps': '',
  'arguably': '',
  'seemingly': '',
  'apparently': '',
  'presumably': '',
  'supposedly': '',
  'allegedly': '',
  'reportedly': '',
};

Object.entries(hedgingWords).forEach(([word, replacement]) => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  if (regex.test(humanized)) {
    humanized = humanized.replace(regex, replacement);
    changes.push(`Removed hedging "${word}"`);
  }
});

// 11. Generic positive conclusions (Section 24)
const genericConclusions = [
  /the future looks bright/gi,
  /exciting times lie ahead/gi,
  /journey toward excellence/gi,
  /represents a major step/gi,
  /step in the right direction/gi,
  /continue their journey/gi,
  /moving forward/gi,
  /going forward/gi,
];

genericConclusions.forEach(pattern => {
  if (pattern.test(humanized)) {
    humanized = humanized.replace(pattern, '');
    changes.push('Removed generic conclusion');
  }
});

// === CLEANUP ===

// Clean up extra spaces
humanized = humanized.replace(/\s+/g, ' ');
humanized = humanized.replace(/\.\s*\./g, '.');
humanized = humanized.replace(/\s+\./g, '.');
humanized = humanized.replace(/\s+,/g, ',');
humanized = humanized.replace(/\s+/g, ' ').trim();

// Remove leading/trailing punctuation weirdness
humanized = humanized.replace(/^[\s.,!?]+|[\s.,!?]+$/g, '');

// Capitalize first letter (but keep intentional lowercase for casual tone)
// Only capitalize if it looks like a sentence start
if (humanized.length > 0 && humanized[0] === humanized[0].toLowerCase()) {
  // Keep lowercase - intentional casual tone
}

// Save humanized output
fs.writeFileSync(outputPath, humanized, 'utf8');

console.log(`\n✅ Humanized output saved to: ${outputPath}`);
console.log(`\n📋 Changes made:`);
if (changes.length === 0) {
  console.log('   (no changes needed - draft was already clean)');
} else {
  const uniqueChanges = [...new Set(changes)];
  uniqueChanges.forEach(change => console.log(`   - ${change}`));
}
console.log(`\n📄 Result:\n"${humanized}"\n`);
