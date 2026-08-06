export function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remaining = Math.max(1, Math.floor(value));
  let result = "";

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }

  return result;
}

export function padPsalm(value: number): string {
  return String(value).padStart(3, "0");
}

export function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ");
}

export function formatVerseMap(verses: number[]): string {
  if (!verses.length) return "";
  if (verses.length === 1) return `v. ${verses[0]}`;
  return `vv. ${verses[0]}–${verses.at(-1)}`;
}
