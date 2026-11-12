const SMALL_NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

function spokenNumber(value: number) {
  if (value < 20) return SMALL_NUMBERS[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones ? `${TENS[tens]}-${SMALL_NUMBERS[ones]}` : TENS[tens];
}

/** Expand written times only for narration; the saved English remains untouched. */
export function textForNarration(text: string) {
  return text.replace(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?\s*m\.?(?=$|[\s,;!?])/gi,
    (_match, hourText: string, minuteText: string | undefined, periodText: string) => {
      const hour = Number(hourText);
      const minute = minuteText === undefined ? null : Number(minuteText);
      const period = periodText.toLowerCase();
      if (minute === null && hour === 12) return period === "a" ? "midnight" : "noon";
      const spokenTime = minute === null || minute === 0
        ? spokenNumber(hour)
        : `${spokenNumber(hour)} ${minute < 10 ? `oh ${spokenNumber(minute)}` : spokenNumber(minute)}`;
      const timeOfDay = period === "a"
        ? (hour === 12 ? "at night" : "in the morning")
        : (hour === 12 || hour < 5 ? "in the afternoon" : hour < 9 ? "in the evening" : "at night");
      return `${spokenTime} ${timeOfDay}`;
    });
}
