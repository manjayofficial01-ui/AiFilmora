/* test-helpers.cjs — shared helpers for the verify-*.cjs suites.
 *
 * Deliberately NOT named verify-*.cjs: verify-all.cjs treats every file
 * matching /^verify-.*\.cjs$/ as a suite and would try to run this one.
 */

/**
 * Dismiss the first-run chooser deterministically.
 *
 * `#firstRunModal` gains its "open" class 400 ms after the app boots. A test
 * that samples "is it open yet?" at an arbitrary moment races that timer:
 * sample too early, the test skips the dismissal, the modal then opens over
 * the page and swallows the next click with
 * "<div id="firstRunModal"> intercepts pointer events".
 *
 * This waits for the modal to actually open — or for it never to open — and
 * only then dismisses it, so the outcome does not depend on how fast the
 * machine happens to be that day.
 *
 * @param {import('playwright').Page} page
 * @param {string} [choice] selector of the button to press
 *                           ("#frSkip" | "#frDemo" | "#frEmpty")
 * @returns {Promise<boolean>} true if the chooser was shown and dismissed
 */
async function dismissFirstRun(page, choice = "#frSkip") {
  const opened = await page
    .waitForSelector("#firstRunModal.open", { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) return false;
  await page.click(choice);
  await page.waitForTimeout(400);
  return true;
}

module.exports = { dismissFirstRun };
