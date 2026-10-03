import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gradeSubmission, missions } from '../build-core/internship.js';
const submissions = JSON.parse(
  await readFile(new URL('./fixtures/internship-submissions.json', import.meta.url), 'utf8'),
);

test('six complete business deliverables pass the transparent training rubric', () => {
  assert.equal(missions.length, 6);
  for (const submission of submissions) {
    const grade = gradeSubmission(submission.missionId, submission.choiceId, submission.text);
    assert.equal(grade.passed, true, submission.missionId);
    assert.equal(grade.score, 100);
  }
});
test('multiple-choice alone does not masquerade as a completed internship task', () => {
  for (const submission of submissions)
    assert.equal(gradeSubmission(submission.missionId, submission.choiceId, '').passed, false);
});
test('correct terminology cannot rescue the wrong product decision', () => {
  for (const submission of submissions) {
    const mission = missions.find((m) => m.id === submission.missionId);
    const wrong = mission.choices.find((c) => !c.correct);
    assert.equal(gradeSubmission(mission.id, wrong.id, submission.text).passed, false);
  }
});
test('ledger training rejects an incorrect amount while accepting formatted correct currency', () => {
  const sample = submissions.find((s) => s.missionId === 'ledger');
  assert.equal(
    gradeSubmission('ledger', sample.choiceId, sample.text.replace('1596.53', '9999.99')).passed,
    false,
  );
  assert.equal(
    gradeSubmission('ledger', sample.choiceId, sample.text.replace('1596.53', '￥1,596.53')).passed,
    true,
  );
  assert.equal(gradeSubmission('ledger', sample.choiceId, sample.text.repeat(6)).passed, false);
});
test('restored progression is recomputed from validated completed deliverables', async () => {
  const mvp = submissions[0];
  const accepted = { choiceId: mvp.choiceId, text: mvp.text, submittedAt: '2026-10-03T00:00:00Z' };
  globalThis.localStorage = {
    getItem: () =>
      JSON.stringify({
        version: 1,
        activeMission: 6,
        unlockedMission: 6,
        entries: { mvp: { choiceId: mvp.choiceId, draft: mvp.text, attempts: 1, accepted } },
      }),
    setItem: () => {},
  };
  const fresh = await import('../build-core/internship.js?progress-check');
  const p = fresh.getInternshipProgress();
  assert.equal(p.unlockedMission, 2);
  assert.equal(p.activeMission, 2);
  p.unlockedMission = 6;
  assert.equal(fresh.getInternshipProgress().unlockedMission, 2);
  delete globalThis.localStorage;
});
test('damaged storage degrades into a working initial task without losing privacy boundaries', async () => {
  globalThis.localStorage = {
    getItem: () => '{broken',
    setItem: () => {
      throw new Error('unavailable');
    },
  };
  const fresh = await import('../build-core/internship.js?broken-storage');
  assert.equal(fresh.getInternshipProgress().unlockedMission, 1);
  assert.match(fresh.renderInternship(), /独立学习项目/);
  delete globalThis.localStorage;
});
