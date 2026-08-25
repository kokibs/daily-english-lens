export type PhotoEntry = {
  id: string;
  imageUrl: string;
  note?: string;
  label?: string;
  time?: string;
};

export type Expression = {
  id: string;
  expression: string;
  japanese: string;
  example: string;
  explanation: string;
  photoId?: string;
  cloze: string;
};

export type DailyEntry = {
  id: string;
  date: string;
  photos: PhotoEntry[];
  diaryEnglish: string;
  diaryJapanese: string;
  moments: MomentSentence[];
  expressions: Expression[];
};

export type MomentSentence = {
  photoId: string;
  english: string;
  japanese: string;
};

export const SAMPLE_PHOTOS: PhotoEntry[] = [
  {
    id: "train",
    imageUrl: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1000&q=85",
    note: "朝の電車がとても混んでいた",
    label: "Morning commute",
    time: "7:42 AM",
  },
  {
    id: "lunch",
    imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85",
    note: "友達と急いで昼ごはんを食べた",
    label: "Lunch break",
    time: "12:24 PM",
  },
  {
    id: "classroom",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1000&q=85",
    note: "放課後、教室で少し友達と話した",
    label: "After class",
    time: "3:36 PM",
  },
  {
    id: "badminton",
    imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1000&q=85",
    note: "バドミントン部の練習でくたくたになった",
    label: "Badminton practice",
    time: "5:18 PM",
  },
  {
    id: "rain",
    imageUrl: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=85",
    note: "部活の帰りに急に雨が降ってびしょ濡れになった",
    label: "On the way home",
    time: "6:18 PM",
  },
];

function dateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function createSampleDailyEntry(date = new Date()): DailyEntry {
  return buildEntry(SAMPLE_PHOTOS, dateOnly(date));
}

function buildEntry(photos: PhotoEntry[], date: string): DailyEntry {
  const photoAt = (index: number) => photos[index]?.id ?? photos[0]?.id;
  const momentTemplates = [
    { english: "The train was packed this morning.", japanese: "今朝の電車はとても混んでいた。" },
    { english: "I grabbed lunch with my friends.", japanese: "友達とさっと昼食を食べた。" },
    { english: "I stayed behind for a quick chat after class.", japanese: "放課後、少し残って友達と話した。" },
    { english: "I was worn out after badminton practice.", japanese: "バドミントンの練習後はくたくただった。" },
    { english: "I got soaked on my way home.", japanese: "帰り道でびしょ濡れになった。" },
  ];

  return {
    id: `day-${date}`,
    date,
    photos,
    diaryEnglish:
      "Today I took a packed train to school. I grabbed lunch with my friends and stayed behind for a quick chat after class. Badminton practice completely wore me out. Then I got caught in the rain on my way home and arrived soaking wet.",
    diaryJapanese:
      "今日は満員電車で学校に行きました。友達とさっと昼食をとり、放課後は少し教室に残っておしゃべりしました。バドミントンの練習ですっかり疲れ、帰り道では雨に降られてびしょ濡れで家に着きました。",
    moments: photos.map((photo, index) => ({
      photoId: photo.id,
      ...(momentTemplates[index] ?? {
        english: photo.note ? "This moment became part of my day." : "I wanted to remember this moment.",
        japanese: photo.note ? "この瞬間も今日の出来事のひとつになった。" : "この瞬間を覚えておきたいと思った。",
      }),
    })),
    expressions: [
      {
        id: "packed",
        expression: "packed",
        japanese: "すし詰めの、とても混んだ",
        example: "The train was packed this morning.",
        explanation: "crowded よりも「隙間がないほど混んでいる」感覚。",
        photoId: photoAt(0),
        cloze: "The train was ______ this morning.",
      },
      {
        id: "grab-lunch",
        expression: "grab lunch",
        japanese: "さっと昼食をとる",
        example: "I grabbed lunch with my friends.",
        explanation: "会話でよく使う軽い言い方。じっくり食べるより、気軽なランチにぴったり。",
        photoId: photoAt(1),
        cloze: "Let's ______ ______ after class.",
      },
      {
        id: "stay-behind",
        expression: "stay behind",
        japanese: "みんなが帰った後に残る",
        example: "I stayed behind for a quick chat after class.",
        explanation: "授業やイベントの後に、その場に少し残るときの自然な表現。",
        photoId: photoAt(2),
        cloze: "I ______ ______ after class.",
      },
      {
        id: "worn-out",
        expression: "worn out",
        japanese: "くたくたの、へとへとの",
        example: "I was worn out after badminton practice.",
        explanation: "tired より強く、体力を使い切った感覚。日常会話で使いやすい。",
        photoId: photoAt(3),
        cloze: "I was ______ ______ after practice.",
      },
      {
        id: "get-soaked",
        expression: "get soaked",
        japanese: "びしょ濡れになる",
        example: "I got soaked on my way home.",
        explanation: "雨などで服までしっかり濡れたときのひとこと。",
        photoId: photoAt(4),
        cloze: "I got ______ on my way home.",
      },
    ],
  };
}

/**
 * AI integration boundary.
 * Replace this mock with a Vision-capable model call while preserving the return type.
 */
export async function generateDailyEnglish(photos: PhotoEntry[]): Promise<DailyEntry> {
  await new Promise((resolve) => setTimeout(resolve, 1350));
  return buildEntry(photos, dateOnly(new Date()));
}
