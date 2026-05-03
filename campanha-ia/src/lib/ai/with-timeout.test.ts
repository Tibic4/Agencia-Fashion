/**
 * Tests para `withTimeout` + `AITimeoutError` (D-17).
 *
 * Por que esses 4 testes:
 *  1. Resolve antes do timeout: caminho feliz (a IA respondeu rápido).
 *  2. Rejeita no timeout: a IA pendurou e queremos AITimeoutError tipado
 *     com label/timeoutMs/retryable=true (o retry loop em callGeminiSafe
 *     depende de retryable=true pra dar a 2ª chance).
 *  3. Timer limpo on resolve: previne o "open handle" warning que
 *     pendura vitest. .finally() garante que o setTimeout não vaza.
 *  4. Timer limpo on reject: idem, mas pelo lado da rejeição interna.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { AITimeoutError, withTimeout } from "./with-timeout";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AITimeoutError", () => {
  it("expõe code/retryable/userMessage e label/timeoutMs do construtor", () => {
    const err = new AITimeoutError("Analyzer", 30_000);
    expect(err.code).toBe("AI_TIMEOUT");
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toBe("A IA demorou demais para responder. Tente novamente.");
    expect(err.label).toBe("Analyzer");
    expect(err.timeoutMs).toBe(30_000);
    expect(err.message).toBe("[Analyzer] timeout after 30000ms");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("withTimeout", () => {
  it("resolve com o valor da promise quando ela ganha a race", async () => {
    const result = await withTimeout(Promise.resolve(42), 100, "test");
    expect(result).toBe(42);
  });

  it("rejeita com AITimeoutError quando a promise excede o timeout", async () => {
    vi.useFakeTimers();

    // Promise que nunca resolve sozinha — força o timer a ganhar.
    const slow = new Promise<number>((resolve) => {
      setTimeout(() => resolve(1), 50_000);
    });

    // Anexa o .catch() pra prevenir unhandled-rejection warning entre o
    // primeiro reject e o expect — vitest reclama se o intervalo entre
    // a rejeição e o await tiver microtasks intermediárias (que é o caso
    // sob fake timers).
    const racePromise = withTimeout(slow, 10, "slow").catch((e) => e);

    // Avança 10ms de wall clock virtual → timeout dispara.
    await vi.advanceTimersByTimeAsync(10);

    const err = await racePromise;
    expect(err).toBeInstanceOf(AITimeoutError);
    expect(err).toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true,
      label: "slow",
      timeoutMs: 10,
    });
  });

  it("limpa o timer via clearTimeout quando a promise resolve antes", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    await withTimeout(Promise.resolve("ok"), 1000, "fast");

    // clearTimeout é chamado dentro do .finally() — uma vez por race
    // (independente de qual lado ganhou). O importante é que o timer
    // não fica vazado.
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("limpa o timer via clearTimeout quando a promise rejeita antes", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    await expect(
      withTimeout(Promise.reject(new Error("boom")), 1000, "reject"),
    ).rejects.toThrow("boom");

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
