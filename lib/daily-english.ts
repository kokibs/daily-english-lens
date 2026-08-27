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

type ExpressionDraft = Omit<Expression, "id" | "photoId" | "cloze">;

type MomentDraft = {
  english: string;
  japanese: string;
  expressions: ExpressionDraft[];
};

const LEGACY_TUTORIAL_PHOTO_IDS = new Set(["train", "lunch", "classroom", "badminton", "rain"]);
const LEGACY_TUTORIAL_DIARY = "Today I took a packed train to school.";

export function dateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function expression(
  expressionText: string,
  japanese: string,
  example: string,
  explanation: string,
): ExpressionDraft {
  return { expression: expressionText, japanese, example, explanation };
}

function inferMoment(photo: PhotoEntry): MomentDraft {
  const source = `${photo.note ?? ""} ${photo.label ?? ""}`.toLowerCase();

  if (/体育祭|運動会|垂れ幕|banner|sports?\s*festival/.test(source)) {
    return {
      english: "The banners at the sports festival looked amazing.",
      japanese: "体育祭の垂れ幕がとてもきれいだった。",
      expressions: [
        expression("stand out", "目を引く、際立つ", "The colorful banners really stood out.", "周りと比べて特に目立ったときに使う自然な表現。"),
        expression("look amazing", "とてもすてきに見える", "The festival banners looked amazing.", "見たものへの強い好印象を素直に伝えられる。"),
      ],
    };
  }

  if (/富嶽|関数アート|アート|artwork|function\s*art|\bart\b/.test(source)) {
    return {
      english: "I worked on a piece of function art inspired by Thirty-six Views of Mount Fuji.",
      japanese: "富嶽三十六景をモチーフにした関数アートに取り組んだ。",
      expressions: [
        expression("work on", "〜に取り組む", "I worked on my function art today.", "作品や課題を進めるときに幅広く使える。"),
        expression("be inspired by", "〜から着想を得る", "My artwork was inspired by a famous landscape print.", "作品のアイデアの源を説明する表現。"),
      ],
    };
  }

  if (/コード|プログラミング|競プロ|スクリーンショット|c\+\+|iostream|program|\bcode\b/.test(source)) {
    return {
      english: "I spent some time working through a programming problem.",
      japanese: "プログラミングの問題をじっくり解いた。",
      expressions: [
        expression("work through", "順を追って取り組む", "I worked through a difficult programming problem.", "難しい問題を少しずつ進めて解く感覚。"),
        expression("figure out", "解き方を見つける、理解する", "I finally figured out what was wrong with my code.", "考えた末に答えや原因を見つけたときに使う。"),
      ],
    };
  }

  if (/ランチ|昼食|昼ごはん|昼ご飯|昼飯|lunch/.test(source)) {
    return {
      english: "I grabbed lunch with my friends.",
      japanese: "友達とさっと昼食を食べた。",
      expressions: [
        expression("grab lunch", "さっと昼食をとる", "I grabbed lunch with my friends.", "気軽なランチにぴったりの会話表現。"),
        expression("catch up", "近況を話し合う", "We caught up over lunch.", "しばらく会っていない人と近況を話すときに使う。"),
      ],
    };
  }

  if (/雨|濡|傘|rain|soak|umbrella/.test(source)) {
    return {
      english: "I got caught in the rain on my way home.",
      japanese: "帰り道に雨に降られた。",
      expressions: [
        expression("get caught in the rain", "雨に降られる", "I got caught in the rain on my way home.", "外にいるとき急に雨に遇った場面で使う。"),
        expression("get soaked", "びしょ濡れになる", "I got soaked before I reached home.", "服までしっかり濡れたときの表現。"),
      ],
    };
  }

  if (/バドミントン|部活|練習|badminton|practice/.test(source)) {
    return {
      english: "Practice completely wore me out today.",
      japanese: "今日の練習ですっかりくたくたになった。",
      expressions: [
        expression("worn out", "くたくたの、へとへの", "I was worn out after practice.", "tired より強く、体力を使い切った感覚。"),
        expression("push myself", "自分を追い込む", "I really pushed myself at practice.", "いつもより頑張って限界に挑戦したときに使う。"),
      ],
    };
  }

  if (/電車|駅|通学|train|station|commute/.test(source)) {
    return {
      english: "I took the train to school this morning.",
      japanese: "今朝は電車で学校へ行った。",
      expressions: [
        expression("take the train", "電車に乗る、電車で行く", "I took the train to school this morning.", "交通手段として電車を使ったことを表す。"),
        expression("on my way", "向かう途中で", "I listened to music on my way to school.", "ある場所へ移動している途中を表す会話表現。"),
      ],
    };
  }

  if (/学校|校舎|教室|授業|school|classroom|class/.test(source)) {
    return {
      english: "I spent part of the day at school.",
      japanese: "今日は学校で時間を過ごした。",
      expressions: [
        expression("spend time", "時間を過ごす", "I spent time with my classmates after school.", "どこで、または誰と時間を過ごしたかを言う基本表現。"),
        expression("after school", "放課後に", "I stayed at school for a while after school.", "学校が終わった後の時間を自然に表す。"),
      ],
    };
  }

  if (photo.note?.trim()) {
    return {
      english: "This moment stood out to me today.",
      japanese: "今日はこの瞬間が特に印象に残った。",
      expressions: [
        expression("stand out", "印象に残る、目立つ", "This moment really stood out to me.", "他の出来事より強く印象に残ったときに使う。"),
        expression("stick with me", "心に残る", "That moment stuck with me all day.", "見たことや聞いたことが長く心に残る感覚。"),
      ],
    };
  }

  return {
    english: "I wanted to remember this moment from today.",
    japanese: "今日のこの瞬間を覚えておきたいと思った。",
    expressions: [
      expression("take a moment", "少し時間をとる", "I took a moment to look around.", "一度立ち止まって何かをする感覚を表す。"),
      expression("look back on", "〜を振り返る", "I like looking back on moments like this.", "過去の出来事を思い出すときに使う。"),
    ],
  };
}

export function makeCloze(exampleText: string, expressionText: string) {
  const words = expressionText.split(/\s+/);
  const blank = words.map(() => "______").join(" ");
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = words.length > 1
    ? `\\b[\\w']+\\s+${words.slice(1).map(escape).join("\\s+")}\\b`
    : `\\b${escape(expressionText)}\\b`;
  const replaced = exampleText.replace(new RegExp(pattern, "i"), blank);
  return replaced === exampleText ? `Complete the expression: ${blank}` : replaced;
}

function buildEntry(photos: PhotoEntry[], date: string): DailyEntry {
  const inferred = photos.map((photo) => ({ photo, draft: inferMoment(photo) }));
  const used = new Set<string>();
  const expressions = inferred.flatMap(({ photo, draft }) => draft.expressions.map((item) => ({ photo, item })))
    .filter(({ item }) => {
      const key = item.expression.toLowerCase();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 6)
    .map(({ photo, item }, index) => ({
      ...item,
      id: `${photo.id}-expression-${index + 1}`,
      photoId: photo.id,
      cloze: makeCloze(item.example, item.expression),
    }));

  return {
    id: `day-${date}`,
    date,
    photos,
    diaryEnglish: inferred.map(({ draft }) => draft.english).join(" "),
    diaryJapanese: inferred.map(({ draft }) => draft.japanese).join(" "),
    moments: inferred.map(({ photo, draft }) => ({
      photoId: photo.id,
      english: draft.english,
      japanese: draft.japanese,
    })),
    expressions,
  };
}

export function isLegacyTutorialEntry(entry: DailyEntry) {
  const photoIds = entry.photos?.map((photo) => photo.id) ?? [];
  return photoIds.length === LEGACY_TUTORIAL_PHOTO_IDS.size
    && photoIds.every((id) => LEGACY_TUTORIAL_PHOTO_IDS.has(id));
}

export function hasLegacyTutorialOutput(entry: DailyEntry) {
  return entry.diaryEnglish?.startsWith(LEGACY_TUTORIAL_DIARY) ?? false;
}

export function createDailyEntryFromPhotos(photos: PhotoEntry[], date = dateOnly(new Date())) {
  return buildEntry(photos, date);
}

/**
 * Client boundary for the server-side Vision model. Photos are sent only when
 * the user presses Generate; API credentials never reach the browser.
 */
export async function generateDailyEnglish(photos: PhotoEntry[]): Promise<DailyEntry> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photos }),
  });
  const result = await response.json() as DailyEntry | { error?: string };
  if (!response.ok) {
    throw new Error("error" in result && result.error ? result.error : "写真を解析できませんでした。少し待って再試行してください。");
  }
  return result as DailyEntry;
}
