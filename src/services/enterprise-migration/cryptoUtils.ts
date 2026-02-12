/**
 * Enterprise Migration Engine — Crypto Utilities
 *
 * Hashing, encryption, and string similarity functions
 * for data lineage, PHI encryption, and deduplication.
 */

export class CryptoUtils {
  /** Create SHA-256 hash of a value */
  static async hashValue(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Generate encryption key */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /** Encrypt data */
  static async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );
    return { ciphertext, iv };
  }

  /** Decrypt data */
  static async decrypt(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /** Calculate Levenshtein distance */
  static levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  /** Calculate Soundex code for phonetic matching */
  static soundex(str: string): string {
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';

    const codes: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };

    let result = s[0];
    let prev = codes[s[0]] || '';

    for (let i = 1; i < s.length && result.length < 4; i++) {
      const code = codes[s[i]];
      if (code && code !== prev) {
        result += code;
      }
      prev = code || prev;
    }

    return result.padEnd(4, '0');
  }

  /** Calculate name similarity (0-1) */
  static nameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;
    if (!n1 || !n2) return 0;

    // Soundex match bonus
    const soundexMatch = this.soundex(n1) === this.soundex(n2) ? 0.3 : 0;

    // Levenshtein similarity
    const maxLen = Math.max(n1.length, n2.length);
    const levenSim = 1 - (this.levenshteinDistance(n1, n2) / maxLen);

    // Trigram similarity (simplified)
    const trigrams1 = this.getTrigrams(n1);
    const trigrams2 = this.getTrigrams(n2);
    const intersection = trigrams1.filter(t => trigrams2.includes(t));
    const union = new Set([...trigrams1, ...trigrams2]);
    const trigramSim = intersection.length / union.size;

    return Math.min(soundexMatch + (levenSim * 0.35) + (trigramSim * 0.35), 1.0);
  }

  /** Get trigrams from string */
  private static getTrigrams(str: string): string[] {
    const padded = `  ${str} `;
    const trigrams: string[] = [];
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.push(padded.substring(i, i + 3));
    }
    return trigrams;
  }
}
