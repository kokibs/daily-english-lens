import assert from "node:assert/strict";
import test from "node:test";

import {
  generateWithVision,
  handleVisionGenerateRequest,
} from "../lib/vision-generator.ts";

const photos = [
  {
    id: "shrine",
    imageUrl: "data:image/jpeg;base64,ZmFrZQ==",
    note: "2時55分に八坂神社に行った",
    label: "IMG_0283",
    time: "2:56 PM",
  },
  {
    id: "sashimi",
    imageUrl: "data:image/jpeg;base64,ZmFrZTI=",
    note: "",
    label: "IMG_0280",
    time: "6:16 PM",
  },
];

const generated = {
  diaryEnglish: "I visited Yasaka Shrine and enjoyed fresh sashimi later.",
  diaryJapanese: "八坂神社を訪れ、その後は新鮮な刺身を楽しんだ。",
  moments: [
    { photoId: "shrine", english: "I visited Yasaka Shrine today.", japanese: "今日は八坂神社を訪れた。" },
    { photoId: "sashimi", english: "I enjoyed a plate of fresh sashimi.", japanese: "新鮮な刺身を味わった。" },
  ],
  expressions: [
    { photoId: "shrine", expression: "visit a shrine", japanese: "神社を訪れる", example: "I visited a shrine today.", explanation: "観光や参拝で使える。" },
    { photoId: "sashimi", expression: "enjoy a meal", japanese: "食事を楽しむ", example: "I enjoyed a delicious meal.", explanation: "食事の感想を伝える。" },
    { photoId: "sashimi", expression: "fresh sashimi", japanese: "新鮮な刺身", example: "The fresh sashimi was delicious.", explanation: "料理の新鮮さを伝える。" },
  ],
};

test("sends every image and note to the Vision model and maps its result", async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(String(init.body)) };
    return Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(generated) }] }],
    });
  };

  const entry = await generateWithVision(photos, "secret-test-key", "vision-test-model", fakeFetch);

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.body.model, "vision-test-model");
  assert.equal(captured.body.store, false);
  assert.match(captured.body.instructions, /Never put underscores/);
  assert.match(captured.body.instructions, /八坂神社を訪れてお参りする/);
  assert.equal(captured.body.input[0].content.filter((item) => item.type === "input_image").length, 2);
  assert.match(captured.body.input[0].content[1].text, /八坂神社に行った/);
  assert.match(captured.body.input[0].content[1].text, /2時55分/);
  assert.equal(entry.moments[0].english, "I visited Yasaka Shrine today.");
  assert.equal(entry.moments[1].english, "I enjoyed a plate of fresh sashimi.");
  assert.ok(entry.expressions.every((item) => item.cloze.includes("______")));
});

test("rejects generated quiz clues that replace concrete nouns with blanks", async () => {
  const outputWithBlankNoun = {
    ...generated,
    expressions: generated.expressions.map((expression, index) => index === 0
      ? { ...expression, japanese: "___を訪れて、そこでお参りする" }
      : expression),
  };
  const fakeFetch = async () => Response.json({
    output: [{ content: [{ type: "output_text", text: JSON.stringify(outputWithBlankNoun) }] }],
  });

  await assert.rejects(
    generateWithVision(photos, "secret-test-key", "vision-test-model", fakeFetch),
    /解析結果が不完全/,
  );
});

test("accepts ten photos and returns one moment for each photo", async () => {
  const tenPhotos = Array.from({ length: 10 }, (_, index) => ({
    ...photos[0],
    id: `photo-${index + 1}`,
    note: `moment ${index + 1}`,
  }));
  const tenMoments = tenPhotos.map((photo, index) => ({
    photoId: photo.id,
    english: `I remembered moment ${index + 1}.`,
    japanese: `出来事${index + 1}を思い出した。`,
  }));
  const tenPhotoOutput = {
    ...generated,
    moments: tenMoments,
    expressions: generated.expressions.map((expression) => ({
      ...expression,
      photoId: tenPhotos[0].id,
    })),
  };
  const fakeFetch = async () => Response.json({
    output: [{ content: [{ type: "output_text", text: JSON.stringify(tenPhotoOutput) }] }],
  });

  const entry = await generateWithVision(tenPhotos, "secret-test-key", "vision-test-model", fakeFetch);

  assert.equal(entry.photos.length, 10);
  assert.equal(entry.moments.length, 10);
  assert.deepEqual(entry.moments.map((moment) => moment.photoId), tenPhotos.map((photo) => photo.id));
});

test("does not fall back to generic copy when the server key is missing", async () => {
  const request = new Request("https://example.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photos }),
  });
  const response = await handleVisionGenerateRequest(request, undefined);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.error, /準備/);
});

test("rejects more than ten photos before calling the Vision API", async () => {
  const request = new Request("https://example.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photos: Array.from({ length: 11 }, (_, index) => ({
      ...photos[0],
      id: `photo-${index}`,
    })) }),
  });
  const response = await handleVisionGenerateRequest(request, "test-key", undefined, async () => {
    throw new Error("Vision API must not be called");
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /1〜10枚/);
});

test("rejects requests above the Vercel payload budget", async () => {
  const request = new Request("https://example.test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "4200001" },
    body: JSON.stringify({ photos }),
  });
  const response = await handleVisionGenerateRequest(request, "test-key");

  assert.equal(response.status, 413);
});
