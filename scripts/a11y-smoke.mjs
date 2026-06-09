import axeCore from 'axe-core';
import { chromium } from 'playwright';

const url = process.env.A11Y_URL || 'http://127.0.0.1:4173/';

function summarizeViolation(violation) {
  return {
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary
    }))
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas[role="img"][aria-label]', { timeout: 15000 });
  await page.addScriptTag({ content: axeCore.source });

  const axeResults = await page.evaluate(async () => {
    return window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      }
    });
  });

  const customChecks = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[role="img"]');
    const fileInput = document.querySelector('input[type="file"]');
    fileInput?.focus();

    return {
      canvasHasTextAlternative: Boolean(canvas?.getAttribute('aria-label')?.trim()),
      fileInputFocusable: document.activeElement === fileInput,
      switchCount: document.querySelectorAll('[role="switch"][aria-checked]').length,
      pressedButtonCount: document.querySelectorAll('button[aria-pressed]').length,
      landmarkMainCount: document.querySelectorAll('main').length
    };
  });

  const failures = [
    ...axeResults.violations.map(summarizeViolation),
    ...(!customChecks.canvasHasTextAlternative ? [{ id: 'canvas-text-alternative', help: 'Canvas must expose the generated wheel summary.' }] : []),
    ...(!customChecks.fileInputFocusable ? [{ id: 'file-input-focusable', help: 'Custom upload input must remain keyboard focusable.' }] : []),
    ...(customChecks.switchCount < 4 ? [{ id: 'switch-state', help: 'Switch controls must expose aria-checked state.' }] : []),
    ...(customChecks.landmarkMainCount !== 1 ? [{ id: 'main-landmark', help: 'Page should expose exactly one main landmark.' }] : [])
  ];

  console.log(
    JSON.stringify(
      {
        url,
        axeViolations: axeResults.violations.length,
        customChecks,
        failures
      },
      null,
      2
    )
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
