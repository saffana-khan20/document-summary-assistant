/**
 * Extractive Summarizer
 * -----------------------------------------
 * Approach: Frequency-based sentence scoring (a simplified TextRank-style method).
 * Why this instead of a paid AI API?
 *   - Works completely free, with no API key, no rate limits, no signup.
 *   - Fast and good enough for typical documents (reports, articles, notes).
 *   - Optional: swap in Hugging Face's free inference API (see summarizeWithHF
 *     below) if you want abstractive (rephrased) summaries instead.
 *
 * How it works:
 *   1. Split text into sentences.
 *   2. Build a word-frequency table (ignoring common "stopwords").
 *   3. Score each sentence by summing the frequency of its meaningful words.
 *   4. Pick the top N highest-scoring sentences, keeping their original order.
 */

const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't",
  "as","at","be","because","been","before","being","below","between","both","but","by",
  "can't","cannot","could","couldn't","did","didn't","do","does","doesn't","doing","don't",
  "down","during","each","few","for","from","further","had","hadn't","has","hasn't","have",
  "haven't","having","he","he'd","he'll","he's","her","here","here's","hers","herself","him",
  "himself","his","how","how's","i","i'd","i'll","i'm","i've","if","in","into","is","isn't",
  "it","it's","its","itself","let's","me","more","most","mustn't","my","myself","no","nor",
  "not","of","off","on","once","only","or","other","ought","our","ours","ourselves","out",
  "over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't","so",
  "some","such","than","that","that's","the","their","theirs","them","themselves","then",
  "there","there's","these","they","they'd","they'll","they're","they've","this","those",
  "through","to","too","under","until","up","very","was","wasn't","we","we'd","we'll",
  "we're","we've","were","weren't","what","what's","when","when's","where","where's",
  "which","while","who","who's","whom","why","why's","with","won't","would","wouldn't",
  "you","you'd","you'll","you're","you've","your","yours","yourself","yourselves"
]);

function splitSentences(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  // Split on sentence-ending punctuation followed by a space + capital letter or end of string.
  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

function tokenizeWords(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(
    (w) => !STOPWORDS.has(w) && w.length > 1
  );
}

function buildWordFrequencies(sentences) {
  const freq = {};
  for (const sentence of sentences) {
    for (const word of tokenizeWords(sentence)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  // Normalize by max frequency so scores are comparable across documents.
  const max = Math.max(1, ...Object.values(freq));
  for (const w in freq) freq[w] = freq[w] / max;
  return freq;
}

function scoreSentences(sentences, freq) {
  return sentences.map((sentence, index) => {
    const words = tokenizeWords(sentence);
    if (words.length === 0) return { index, sentence, score: 0 };
    const rawScore = words.reduce((sum, w) => sum + (freq[w] || 0), 0);
    // Slightly favor sentences of moderate length (avoid picking tiny fragments).
    const lengthPenalty = words.length < 4 ? 0.5 : 1;
    return { index, sentence, score: (rawScore / words.length) * lengthPenalty };
  });
}

/**
 * @param {string} text - full extracted document text
 * @param {"short"|"medium"|"long"} length - desired summary length
 */
function summarize(text, length = "medium") {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { summary: "", keyPoints: [], sentenceCount: 0 };
  }

  const freq = buildWordFrequencies(sentences);
  const scored = scoreSentences(sentences, freq);

  const ratios = { short: 0.15, medium: 0.3, long: 0.5 };
  const ratio = ratios[length] ?? ratios.medium;
  const targetCount = Math.max(1, Math.min(sentences.length, Math.round(sentences.length * ratio)));

  const topSentences = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount)
    .sort((a, b) => a.index - b.index); // restore original reading order

  const summary = topSentences.map((s) => s.sentence).join(" ");

  // Key points: top 5 highest scoring sentences, regardless of the summary length chosen.
  const keyPoints = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);

  return { summary, keyPoints, sentenceCount: sentences.length };
}

module.exports = { summarize };
