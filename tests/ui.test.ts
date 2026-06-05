/**
 * WorkVoice — Stagehand UI tests
 *
 * Drives a real browser against the Expo web build using Stagehand's AI
 * primitives (act / extract / observe). Semantic assertions are made with
 * extract() + Zod schemas so tests survive markup changes.
 *
 * Env:
 *   BASE_URL            target to test (default http://localhost:4173)
 *   ANTHROPIC_API_KEY   LLM key for Stagehand
 *   STAGEHAND_MODEL     override model (default anthropic claude sonnet)
 */
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const MODEL = process.env.STAGEHAND_MODEL || 'anthropic/claude-sonnet-4-5';

let passed = 0;
let failed = 0;
const results: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    results.push(`  ✅ ${name}`);
    console.log(`✅ ${name}`);
  } catch (e: any) {
    failed++;
    results.push(`  ❌ ${name}: ${e.message}`);
    console.error(`❌ ${name}\n   ${e.message}`);
    // GitHub Actions annotation — surfaces failures in the run UI and the checks API
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::error title=UI test failed: ${name}::${String(e.message).replace(/\n/g, ' ').slice(0, 400)}`);
    }
  }
}

async function main() {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    model: MODEL,
    verbose: 0,
    localBrowserLaunchOptions: {
      // Stagehand's CDP driver needs an explicit Chrome path (CHROME_PATH),
      // and CI containers need sandbox/shm flags.
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
      headless: true,
      chromiumSandbox: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
    },
  });
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  await page.goto(BASE_URL, { waitUntil: 'networkidle' as any }).catch(async () => {
    await page.goto(BASE_URL);
  });
  await new Promise(r => setTimeout(r, 2500)); // let the RN-web bundle hydrate

  // ── 1. Dashboard is the landing view ────────────────────────────────
  await test('dashboard loads with branding, greeting and 4 stat cards', async () => {
    const brand = await page.evaluate(
      "(document.querySelector('[data-testid=brand]')||{}).textContent || ''",
    );
    assert.match(String(brand).replace(/\s/g, ''), /WORKVOICE/i, `brand was "${brand}"`);
    const d = await stagehand.extract(
      'Look at the current screen and report what you see',
      z.object({
        greeting: z.string().describe('the large greeting headline, e.g. Good morning'),
        statCardCount: z.number().describe('how many small statistic cards with a number and label are visible'),
        statLabels: z.array(z.string()).describe('the labels of the statistic cards'),
      }),
    );
    assert.match(d.greeting, /Good (morning|afternoon|evening)/i, `greeting was "${d.greeting}"`);
    assert.equal(d.statCardCount, 4, `expected 4 stat cards, saw ${d.statCardCount}`);
    const labels = d.statLabels.join(' ').toUpperCase();
    for (const want of ['NOTES', 'VOICE', 'STARRED', 'WORDS']) {
      assert.ok(labels.includes(want), `missing stat label ${want} in [${labels}]`);
    }
  });

  // ── 2. Install on iOS flow ──────────────────────────────────────────
  await test('Install on iOS button opens guided install modal', async () => {
    await stagehand.act('click the "Install on iOS" button');
    await new Promise(r => setTimeout(r, 800));
    const m = await stagehand.extract(
      'A modal dialog should be open. Describe it.',
      z.object({
        isModalOpen: z.boolean(),
        title: z.string(),
        stepCount: z.number().describe('number of numbered instruction steps'),
        mentionsSafari: z.boolean().describe('whether the steps mention opening in Safari'),
        mentionsAddToHomeScreen: z.boolean().describe('whether the steps mention Add to Home Screen'),
      }),
    );
    assert.ok(m.isModalOpen, 'modal did not open');
    assert.match(m.title, /install/i, `modal title was "${m.title}"`);
    assert.equal(m.stepCount, 4, `expected 4 steps, saw ${m.stepCount}`);
    assert.ok(m.mentionsSafari, 'steps do not mention Safari');
    assert.ok(m.mentionsAddToHomeScreen, 'steps do not mention Add to Home Screen');
    await stagehand.act('click the "Close" button inside the modal');
    await new Promise(r => setTimeout(r, 800));
    const closed = await stagehand.extract(
      'Is a modal dialog currently open on top of the app?',
      z.object({ isModalOpen: z.boolean() }),
    );
    assert.ok(!closed.isModalOpen, 'modal failed to close — would block all later interactions');
  });

  // ── 3. Notes list, search and filters ───────────────────────────────
  await test('notes view search narrows results', async () => {
    await stagehand.act('click the NOTES navigation tab');
    await new Promise(r => setTimeout(r, 600));
    const before = await stagehand.extract(
      'Count the note cards in the list',
      z.object({ count: z.number() }),
    );
    assert.ok(before.count >= 3, `expected seed notes, saw ${before.count}`);

    await stagehand.act('type "Meridian" into the search input');
    await new Promise(r => setTimeout(r, 600));
    const after = await stagehand.extract(
      'Count the note cards now visible and give the title of the first one',
      z.object({ count: z.number(), firstTitle: z.string() }),
    );
    assert.equal(after.count, 1, `search should leave 1 result, saw ${after.count}`);
    assert.match(after.firstTitle, /Meridian/i, `unexpected result "${after.firstTitle}"`);

    // clear the search field deterministically (React-controlled input)
    await page.evaluate(`
      var el=document.querySelector('[data-testid=search-input]');
      var set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      el.focus(); set.call(el,''); el.dispatchEvent(new Event('input',{bubbles:true})); true`);
    await new Promise(r => setTimeout(r, 500));
    const cleared = await stagehand.extract('Count the note cards now visible', z.object({ count: z.number() }));
    assert.ok(cleared.count >= 3, `search did not clear, still ${cleared.count} cards`);
  });

  await test('starred filter chip shows only starred notes', async () => {
    await stagehand.act('click the STARRED filter chip');
    await new Promise(r => setTimeout(r, 600));
    const d = await stagehand.extract(
      'Count visible note cards and report whether each shows a highlighted star',
      z.object({ count: z.number() }),
    );
    assert.equal(d.count, 1, `expected 1 starred seed note, saw ${d.count}`);
    await stagehand.act('click the ALL filter chip');
  });

  // ── 4. Create + edit a note ─────────────────────────────────────────
  await test('creating a note opens the editor and saves text', async () => {
    await stagehand.act('click the NEW NOTE button');
    await new Promise(r => setTimeout(r, 600));
    await stagehand.act('click the note title input field at the top of the editor');
    await stagehand.act('type "Stagehand smoke test"');
    await stagehand.act('click the large note body text area below the title');
    await stagehand.act('type "written by an automated browser agent"');
    await new Promise(r => setTimeout(r, 500));
    const vals = await page.evaluate(
      "JSON.stringify({" +
      "title:(document.querySelector('[data-testid=title-input]')||{}).value||''," +
      "body:(document.querySelector('[data-testid=body-input]')||{}).value||''})",
    );
    const { title, body } = JSON.parse(String(vals));
    assert.match(title, /Stagehand smoke test/i, `title field held "${title}"`);
    assert.match(body, /automated browser agent/i, `body field held "${body}"`);
    await stagehand.act('click the back arrow button labeled "Back to notes list"');
    await new Promise(r => setTimeout(r, 600));
    // ensure no stale filter/search hides the new note
    await page.evaluate(`
      var c=document.querySelector('[data-testid=chip-all]'); if(c) c.click();
      var s=document.querySelector('[data-testid=search-input]');
      if(s){var set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
            set.call(s,''); s.dispatchEvent(new Event('input',{bubbles:true}));}
      true`);
    await new Promise(r => setTimeout(r, 500));
    const listText = await page.evaluate("document.body.textContent || ''");
    assert.ok(/Stagehand smoke test/i.test(String(listText)), 'new note not visible in the list');
  });

  // ── 5. Dictation flow (simulated transcription in headless CI) ──────
  await test('record button opens dictation sheet with live transcript', async () => {
    await stagehand.act('click the round microphone record button at the bottom of the screen');
    await new Promise(r => setTimeout(r, 3500)); // let transcript stream
    const d = await stagehand.extract(
      'A recording panel should be visible. Describe it.',
      z.object({
        isRecordingPanelVisible: z.boolean(),
        timerText: z.string().describe('the mm:ss timer text'),
        transcriptWordCount: z.number().describe('approximate number of words in the live transcript area'),
      }),
    );
    assert.ok(d.isRecordingPanelVisible, 'recording panel not visible');
    assert.match(d.timerText, /\d{2}:\d{2}/, `timer was "${d.timerText}"`);
    assert.ok(d.transcriptWordCount >= 3, `transcript not streaming (words: ${d.transcriptWordCount})`);
  });

  await test('stop & insert places the transcript into the note body', async () => {
    await stagehand.act('click the "Stop & insert transcript" button');
    await new Promise(r => setTimeout(r, 900));
    const d = await stagehand.extract(
      'Look at the note editor body text',
      z.object({
        containsVoiceTranscriptBlock: z.boolean().describe('whether the body contains a VOICE TRANSCRIPT section'),
      }),
    );
    assert.ok(d.containsVoiceTranscriptBlock, 'transcript block missing from note body');
  });

  // ── 6. Theme toggle ─────────────────────────────────────────────────
  await test('theme toggle switches between dark and light', async () => {
    const bgProbe =
      "Array.from(document.querySelectorAll('div'))" +
      ".map(d=>getComputedStyle(d).backgroundColor)" +
      ".find(c=>c && c!=='rgba(0, 0, 0, 0)') || ''";
    const before = await page.evaluate(bgProbe);
    await stagehand.act('click the button labeled "Toggle color theme" in the top header');
    await new Promise(r => setTimeout(r, 700));
    const after = await page.evaluate(bgProbe);
    assert.notEqual(before, after, `background did not change (still ${after})`);
  });

  await stagehand.close();

  console.log('\n──── WorkVoice UI test summary ────');
  results.forEach(r => console.log(r));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
