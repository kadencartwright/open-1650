import Hypher from "hypher";
import english from "hyphenation.en-us";
import { syllable } from "syllable";

const hypher = new Hypher({
  ...english,
  leftmin: 1,
  rightmin: 1,
});

const markedFragmentPatterns = new Map(
  Object.entries({
    "avenging": ["a", "veng", "ing"],
    "blessedness": ["bless", "ed", "ness"],
    "blood-guiltiness": ["blood-", "guilt", "i", "ness"],
    "city": ["cit", "y"],
    "desolätions": ["des", "o", "lä", "ti", "ons"],
    "dweller": ["dwell", "er"],
    "dwelling-place": ["dwell", "ing-", "place"],
    "ever": ["ev", "er"],
    "everlasting": ["ev", "er", "last", "ing"],
    "foundätions": ["found", "ä", "ti", "ons"],
    "generätion": ["gen", "er", "ä", "ti", "on"],
    "honoureth": ["hon", "our", "eth"],
    "loving-kindness": ["lov", "ing-", "kind", "ness"],
    "loving-kindnesses": ["lov", "ing-", "kind", "ness", "es"],
    "nätions": ["nä", "ti", "ons"],
    "opprëssion": ["op", "prës", "si", "on"],
    "redëmption": ["re", "dëmp", "ti", "on"],
    "rïghteous": ["rïght", "e", "ous"],
    "salvätion": ["sal", "vä", "ti", "on"],
    "scorner": ["scor", "ner"],
    "silent": ["si", "lent"],
    "solemn": ["sol", "emn"],
    "statutes": ["stat", "utes"],
    "uplifter": ["up", "lift", "er"],
    "water-brooks": ["wa", "ter-", "brooks"],
    "water-spouts": ["wa", "ter-", "spouts"],
    "israèl": ["Is", "ra", "èl"],
    "powèr": ["pow", "èr"],
    "prayèr": ["pray", "èr"],
    "th’avenging": ["th’a", "veng", "ing"],
  }),
);

const forcedCounts = new Map(
  Object.entries({
    appointed: 2,
    anointed: 3,
    possession: 3,
    therefore: 2,
    prayer: 1,
    enlarged: 2,
    safety: 2,
    tongue: 1,
    moved: 2,
    preach: 1,
    "bridegroom-like": 3,
    going: 2,
    altogether: 3,
    moreover: 3,
    presumptuous: 3,
    thereof: 2,
    continually: 4,
    heretofore: 3,
    graciously: 3,
    prove: 1,
    tumultuously: 4,
    chariot: 2,
    iniquity: 4,
    spirit: 2,
    else: 1,
    parched: 1,
    prey: 1,
    assured: 3,
    equity: 3,
    likewise: 2,
    "loving-kindnesses": 5,
    israel: 3,
    plenteous: 3,
    precious: 2,
    glorious: 2,
    zion: 2,
    henceforth: 2,
    falsehood: 2,
    wherewith: 2,
    wherefore: 2,
    eyelids: 2,
    furious: 2,
    tongues: 1,
    oer: 1,
    cheerfully: 3,
    gracious: 2,
    sanctuary: 3,
    chariots: 2,
    horses: 2,
    dissemblers: 3,
    tabernacle: 3,
    witnesses: 3,
    doeth: 2,
    goings: 2,
    blessedness: 3,
  }),
);

// The received text marks many unusual pronunciations typographically, but
// early-modern metre also permits ordinary-looking words to expand or contract.
// These preferences guide the line fitter without pretending that one global
// pronunciation is correct in every context.
const metricalPreferences = new Map(
  Object.entries({
    aloes: [3, 2],
    altogether: [3, 4],
    answer: [2, 1],
    blessedness: [3, 2],
    cassia: [3, 2],
    chastening: [2, 3],
    cheerfully: [3, 4],
    continually: [4, 5],
    conversation: [4, 5],
    covenant: [2, 3],
    cruel: [2, 1],
    cruelty: [3, 2],
    digged: [1, 2],
    doeth: [2, 1],
    doing: [2, 1],
    enemy: [3, 2],
    ever: [1, 2],
    falsehood: [2, 3],
    fire: [1, 2],
    gracious: [2, 3],
    horses: [2, 1],
    moved: [1, 2],
    never: [1, 2],
    oer: [1, 2],
    places: [1, 2],
    prayer: [1, 2],
    praises: [2, 1],
    proudly: [2, 3],
    proves: [1, 2],
    river: [1, 2],
    salvation: [3, 4],
    spirit: [2, 1],
    tongues: [1, 2],
    wherefore: [2, 3],
    wherewith: [2, 3],
    witnesses: [3, 2],
  }),
);

// The final component is the zero-based word index. These are historic
// pronunciation decisions that cannot safely be represented by one global rule.
const contextualCounts = new Map(
  Object.entries({
    "2.4.3.2": 1,
    "2.4.4.4": 2,
    "19.7.2.4": 1,
    "51.3.4.3": 2,
    "51.4.3.5": 3,
    "51.8.4.2": 1,
    "51.9.2.2": 1,
    "51.9.4.3": 1,
    "84.8.1.5": 2,
  }),
);

export function bareWord(word) {
  return word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}-]/gu, "")
    .toLocaleLowerCase();
}

export function metricalSyllableCount(word, contextKey) {
  if (
    /^(?:th[’']|[’']s|[’']t|[’']lt)$/iu.test(
      word.replace(/[.,;:!?()[\]]/g, ""),
    )
  ) {
    return 0;
  }

  if (contextualCounts.has(contextKey)) return contextualCounts.get(contextKey);
  const countedWord = word
    .replace(/^th’/iu, "")
    .replace(/’(?:s|lt)(?=[.,;:!?()[\]]*$)/iu, "");
  const markedKey = countedWord
    .replace(/[.,;:!?()[\]]+$/gu, "")
    .toLocaleLowerCase();
  const markedPattern = markedFragmentPatterns.get(markedKey);
  if (markedPattern) return markedPattern.length;
  const plain = bareWord(countedWord);
  if (forcedCounts.has(plain)) return forcedCounts.get(plain);

  let count = syllable(plain);
  count += (word.match(/[äëïöü]/giu) ?? []).length;
  if (/[èÈ]d\b/u.test(word) && !/[äëïöü]/iu.test(word)) count += 1;
  return Math.max(1, count);
}

function alternateCountCost(word, baseCount, candidateCount) {
  if (candidateCount === baseCount) return 0;

  const plain = bareWord(word);
  const preference = metricalPreferences.get(plain);
  const preferenceIndex = preference?.indexOf(candidateCount) ?? -1;
  if (preferenceIndex >= 0) return 2 + preferenceIndex;

  const distance = Math.abs(candidateCount - baseCount);
  const apostropheBonus = /[’']/u.test(word) && candidateCount < baseCount;
  const pronouncedEndingBonus =
    /(?:èd|ed|eth)(?:[.,;:!?()[\]]*)$/iu.test(word) &&
    candidateCount > baseCount;
  const longWordPenalty = Math.max(0, 7 - plain.length);
  return (
    20 * distance +
    longWordPenalty +
    (apostropheBonus || pronouncedEndingBonus ? -5 : 0)
  );
}

function candidateCounts(word, baseCount) {
  if (baseCount === 0) return [0];

  const plain = bareWord(word);
  const candidates = new Set([baseCount]);
  const preference = metricalPreferences.get(plain) ?? [];
  for (const count of preference) candidates.add(count);

  // A generic fallback is necessary because the received Psalter does not
  // mark every historical expansion and contraction. Keep it tightly bounded:
  // short function words remain fixed, while lexical words may move at most
  // two syllables from the dictionary estimate.
  if (plain.length >= 4) {
    candidates.add(Math.max(1, baseCount - 1));
    candidates.add(baseCount + 1);
  }
  if (plain.length >= 8) {
    candidates.add(Math.max(1, baseCount - 2));
    candidates.add(baseCount + 2);
  }

  return [...candidates]
    .filter((count) => count >= 1 && count <= Math.max(1, plain.length))
    .filter((count) => {
      try {
        const fragments = splitMetricalWord(word, count);
        return fragments.length === count && fragments.join("") === word;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left - right);
}

export function fitMetricalLine(words, desiredCount, contextPrefix) {
  const baseCounts = words.map((word, wordIndex) =>
    metricalSyllableCount(word, `${contextPrefix}.${wordIndex}`),
  );
  if (baseCounts.reduce((sum, count) => sum + count, 0) === desiredCount) {
    return { counts: baseCounts, adjustments: [] };
  }

  let states = new Map([[0, { cost: 0, counts: [] }]]);
  for (const [wordIndex, word] of words.entries()) {
    const nextStates = new Map();
    for (const state of states.values()) {
      for (const count of candidateCounts(word, baseCounts[wordIndex])) {
        const total = state.counts.reduce((sum, value) => sum + value, 0) + count;
        if (total > desiredCount) continue;

        const cost =
          state.cost +
          alternateCountCost(word, baseCounts[wordIndex], count);
        const incumbent = nextStates.get(total);
        if (!incumbent || cost < incumbent.cost) {
          nextStates.set(total, {
            cost,
            counts: [...state.counts, count],
          });
        }
      }
    }
    states = nextStates;
  }

  const fitted = states.get(desiredCount);
  if (!fitted) {
    throw new Error(
      `${contextPrefix} could not fit ${baseCounts.join("+")} syllables to ${desiredCount}.`,
    );
  }

  return {
    counts: fitted.counts,
    adjustments: words.flatMap((word, wordIndex) =>
      fitted.counts[wordIndex] === baseCounts[wordIndex]
        ? []
        : [
            {
              word,
              wordIndex,
              from: baseCounts[wordIndex],
              to: fitted.counts[wordIndex],
            },
          ],
    ),
  };
}

function normalizedPositions(text) {
  const positions = [];
  let length = 0;
  for (const character of Array.from(text)) {
    length += bareWord(character).length;
    positions.push(length);
  }
  return positions;
}

function splitAtNormalizedBoundaries(text, boundaries) {
  const characters = Array.from(text);
  const positions = normalizedPositions(text);
  const pieces = [];
  let start = 0;

  for (const boundary of boundaries) {
    let end = positions.findIndex((position) => position >= boundary) + 1;
    if (end <= start) end = start + 1;
    pieces.push(characters.slice(start, end).join(""));
    start = end;
  }
  pieces.push(characters.slice(start).join(""));
  return pieces;
}

function candidateBoundaries(plain) {
  const boundaries = new Set();
  let offset = 0;
  for (const part of hypher.hyphenate(plain).slice(0, -1)) {
    offset += part.length;
    boundaries.add(offset);
  }

  const vowelGroups = [...plain.matchAll(/[aeiouy]+/giu)];
  for (let index = 0; index < vowelGroups.length - 1; index += 1) {
    const leftEnd = vowelGroups[index].index + vowelGroups[index][0].length;
    const rightStart = vowelGroups[index + 1].index;
    const gapLength = rightStart - leftEnd;
    // Leave a single intervocalic consonant with the following syllable, and
    // divide larger clusters after their first consonant.
    boundaries.add(leftEnd + Math.max(0, gapLength - 1));
  }

  return [...boundaries]
    .filter((boundary) => boundary > 0 && boundary < plain.length)
    .sort((left, right) => left - right);
}

export function splitMetricalWord(word, desiredCount) {
  if (desiredCount < 1) return [];
  if (desiredCount === 1) return [word];

  const leadingElision = word.match(/^th’/iu)?.[0] ?? "";
  const trailingElision =
    word.match(/’(?:s|lt)(?=[.,;:!?()[\]]*$)/iu)?.[0] ?? "";
  if (leadingElision || trailingElision) {
    const base = word
      .slice(leadingElision.length)
      .replace(/’(?:s|lt)(?=[.,;:!?()[\]]*$)/iu, "");
    const pieces = splitMetricalWord(base, desiredCount);
    if (leadingElision) pieces[0] = leadingElision + pieces[0];
    if (trailingElision) {
      const punctuation = word.slice(
        word.indexOf(trailingElision) + trailingElision.length,
      );
      pieces[pieces.length - 1] =
        pieces.at(-1).replace(punctuation, "") +
        trailingElision +
        punctuation;
    }
    return pieces;
  }

  const plain = bareWord(word);
  // In Psalm 2:6 the received edition underlines these three-spoken-syllable
  // words to compress them into two metrical note positions. Keep the initial
  // unstressed vowel separate; the remaining syllables share the final note.
  // This is an editorial underlay interpretation, not a lyric division printed
  // in the wordless CCEH tune score. See underlay-decisions.json.
  if (desiredCount === 2 && (plain === "appointed" || plain === "anointed")) {
    return splitAtNormalizedBoundaries(word, [1]);
  }
  const markedKey = word
    .replace(/[.,;:!?()[\]]+$/gu, "")
    .toLocaleLowerCase();
  const markedPattern = markedFragmentPatterns.get(markedKey);
  if (markedPattern) {
    if (markedPattern.length !== desiredCount) {
      throw new Error(
        `Marked pattern for "${word}" has ${markedPattern.length} parts; expected ${desiredCount}.`,
      );
    }
    const boundaries = [];
    let offset = 0;
    for (const fragment of markedPattern.slice(0, -1)) {
      offset += bareWord(fragment).length;
      boundaries.push(offset);
    }
    return splitAtNormalizedBoundaries(word, boundaries);
  }

  const pronouncedEd = word.match(/èd([.,;:!?()[\]]*)$/iu);
  if (pronouncedEd && desiredCount > 1) {
    const endingLength = Array.from(pronouncedEd[0]).length;
    const base = Array.from(word).slice(0, -endingLength).join("");
    const pieces = splitMetricalWord(base, desiredCount - 1);
    pieces.push(pronouncedEd[0]);
    return pieces;
  }

  const hyphenated = hypher.hyphenate(plain);
  if (hyphenated.length === desiredCount) {
    const boundaries = [];
    let offset = 0;
    for (const fragment of hyphenated.slice(0, -1)) {
      offset += fragment.length;
      boundaries.push(offset);
    }
    return splitAtNormalizedBoundaries(word, boundaries);
  }

  const candidates = candidateBoundaries(plain);
  if (candidates.length < desiredCount - 1) {
    for (let offset = 1; offset < plain.length; offset += 1) {
      if (!candidates.includes(offset)) candidates.push(offset);
    }
    candidates.sort((left, right) => left - right);
  }

  const chosen = [];
  let lowerBound = 0;
  for (let index = 1; index < desiredCount; index += 1) {
    const target = (plain.length * index) / desiredCount;
    const remaining = desiredCount - index;
    let available = candidates.filter(
      (boundary) =>
        boundary > lowerBound && plain.length - boundary >= remaining,
    );
    if (available.length === 0) {
      available = Array.from(
        { length: plain.length - lowerBound - remaining - 1 },
        (_, offset) => lowerBound + offset + 1,
      );
    }
    const boundary = available.reduce((best, candidate) =>
      Math.abs(candidate - target) < Math.abs(best - target)
        ? candidate
        : best,
    );
    chosen.push(boundary);
    lowerBound = boundary;
  }

  const pieces = splitAtNormalizedBoundaries(word, chosen);
  if (
    pieces.length !== desiredCount ||
    pieces.some((piece) => piece.length === 0) ||
    pieces.join("") !== word
  ) {
    throw new Error(
      `Could not split "${word}" into ${desiredCount} metrical syllables.`,
    );
  }
  return pieces;
}

export function groupMetricalTokens(words, counts) {
  const groups = [];
  let prefix = "";

  for (const [index, word] of words.entries()) {
    const count = counts[index];
    if (count === 0) {
      if (/^th[’']$/iu.test(word.replace(/[.,;:!?()[\]]/g, ""))) {
        prefix = prefix ? `${prefix} ${word}` : word;
      } else {
        const previous = groups.at(-1);
        if (!previous) {
          throw new Error(`Elision "${word}" has no preceding word.`);
        }
        previous.text += ` ${word}`;
        previous.fragments[previous.fragments.length - 1] += ` ${word}`;
      }
      continue;
    }

    const fragments = splitMetricalWord(word, count);
    const text = prefix ? `${prefix} ${word}` : word;
    if (prefix) fragments[0] = `${prefix} ${fragments[0]}`;
    groups.push({ text, fragments });
    prefix = "";
  }

  if (prefix) {
    throw new Error(`Dangling elision "${prefix}".`);
  }
  return groups;
}
