import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';

const KEY_LAST_PROMPT = 'review_last_prompt_at';
const KEY_SUCCESS_COUNT = 'review_success_count';

const MIN_SUCCESSES_BEFORE_PROMPT = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 30;

async function readNumber(key: string): Promise<number> {
  try {
    const v = await SecureStore.getItemAsync(key);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

async function writeNumber(key: string, value: number) {
  try {
    await SecureStore.setItemAsync(key, String(value));
  } catch {
    /* ignore */
  }
}

export async function recordSuccess() {
  const count = await readNumber(KEY_SUCCESS_COUNT);
  await writeNumber(KEY_SUCCESS_COUNT, count + 1);
}

export async function maybeRequestReview() {
  try {
    const successes = await readNumber(KEY_SUCCESS_COUNT);
    if (successes < MIN_SUCCESSES_BEFORE_PROMPT) return;

    const lastPrompt = await readNumber(KEY_LAST_PROMPT);
    const now = Date.now();
    const daysSince = (now - lastPrompt) / (1000 * 60 * 60 * 24);
    if (lastPrompt > 0 && daysSince < MIN_DAYS_BETWEEN_PROMPTS) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    await StoreReview.requestReview();
    await writeNumber(KEY_LAST_PROMPT, now);
  } catch {
    /* never throw to UI */
  }
}
