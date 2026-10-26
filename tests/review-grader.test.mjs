import assert from "node:assert/strict";
import test from "node:test";

import { gradeReviewAnswer, handleReviewGradeRequest } from "../lib/review-grader.ts";

const answer = {
  clue: "神戸女学院の文化祭に行く",
  reference: "I went to a school festival at Kobe College.",
  answer: "I attended Kobe College's school festival.",
};

function request(body) {
  return new Request("https://example.test/api/review/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("exact answers are correct without an AI request", async () => {
  const grade = await gradeReviewAnswer(
    { ...answer, answer: "i went to a school festival at kobe college!" },
    "secret-test-key",
    "review-test-model",
    async () => { throw new Error("AI must not be called"); },
  );
  assert.equal(grade, "correct");
});

test("semantic grading sends only text, keeps the key server-side, and accepts a paraphrase", async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: '{"grade":"correct"}' }] }],
    });
  };

  const grade = await gradeReviewAnswer(answer, "secret-test-key", "review-test-model", fakeFetch);

  assert.equal(grade, "correct");
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.init.headers.authorization, "Bearer secret-test-key");
  assert.equal(captured.body.model, "review-test-model");
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.text.format.type, "json_schema");
  assert.match(captured.body.instructions, /same words or word order|words match the reference/);
  assert.match(captured.body.input[0].content[0].text, /神戸女学院の文化祭に行く/);
  assert.doesNotMatch(JSON.stringify(captured.body), /input_image/);
});

test("missing essential details can be marked almost and changed events wrong", async () => {
  for (const expectedGrade of ["almost", "wrong"]) {
    const response = await handleReviewGradeRequest(
      request(answer),
      "secret-test-key",
      "review-test-model",
      async () => Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ grade: expectedGrade }) }] }] }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { grade: expectedGrade });
  }
});

test("invalid input, missing key, and oversized answers are rejected before calling AI", async () => {
  const noAi = async () => { throw new Error("AI must not be called"); };
  assert.equal((await handleReviewGradeRequest(request({ ...answer, answer: "" }), "key", undefined, noAi)).status, 400);
  assert.equal((await handleReviewGradeRequest(request(answer), undefined, undefined, noAi)).status, 503);
  assert.equal((await handleReviewGradeRequest(request({ ...answer, answer: "a".repeat(501) }), "key", undefined, noAi)).status, 400);
});

test("AI failures are retryable errors, never incorrect grades", async () => {
  const badResponse = await handleReviewGradeRequest(
    request(answer), "secret-test-key", "review-test-model",
    async () => Response.json({ output: [{ content: [{ type: "output_text", text: '{"grade":"unknown"}' }] }] }),
  );
  assert.equal(badResponse.status, 502);
  const body = await badResponse.json();
  assert.ok(body.error);
  assert.equal(body.grade, undefined);
});
