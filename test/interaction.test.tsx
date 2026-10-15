import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import {
  ConfirmationProvider,
  isFormEdit,
  Modal,
  useConfirmation,
} from "../components/UI";
import { PlannedPanel } from "../components/wallet/PlannedPanel";
import { WorkspaceLayout } from "../components/AppShell";
import { SessionProvider } from "../components/SessionProvider";
import { clearSession, saveSession, hasSession } from "../lib/api";
import type { PlannedItem } from "../lib/planning";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/wallet",
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) => (
    <a href={String(href)} {...(rest as object)}>
      {children as never}
    </a>
  ),
}));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  Object.defineProperties(window, {
    localStorage: { configurable: true, value: memoryStorage() },
    sessionStorage: { configurable: true, value: memoryStorage() },
  });
  clearSession();
  replace.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isFormEdit", () => {
  it("counts only real form fields", () => {
    const form = document.createElement("form");
    form.innerHTML =
      '<input id="a"><input id="s" type="search"><div role="listbox"><input id="l"></div><input id="n" data-no-dirty>';
    document.body.append(form);
    const get = (id: string) => form.querySelector<HTMLElement>(`#${id}`);
    expect(isFormEdit(get("a"))).toBe(true);
    expect(isFormEdit(get("s"))).toBe(false);
    expect(isFormEdit(get("l"))).toBe(false);
    expect(isFormEdit(get("n"))).toBe(false);
    const loose = document.createElement("input");
    document.body.append(loose);
    expect(isFormEdit(loose)).toBe(false);
    form.remove();
    loose.remove();
  });
});

describe("modal discard guard and typed confirmation", () => {
  function Host({ onResult }: { onResult: (v: boolean) => void }) {
    const confirm = useConfirmation();
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open form</button>
        <button
          onClick={() =>
            void confirm({
              title: "Delete your account?",
              description: "Irreversible.",
              confirmLabel: "Delete account",
              danger: true,
              requireText: "DELETE",
            }).then(onResult)
          }
        >
          open delete
        </button>
        {open && (
          <Modal title="Edit" subtitle="Form" onClose={() => setOpen(false)}>
            <form>
              <input aria-label="amount" />
              <input aria-label="find" type="search" />
            </form>
          </Modal>
        )}
      </>
    );
  }
  const setup = (onResult = vi.fn()) => {
    render(
      <ConfirmationProvider>
        <Host onResult={onResult} />
      </ConfirmationProvider>,
    );
    return onResult;
  };
  const esc = () => fireEvent.keyDown(document, { key: "Escape" });

  it("typed DELETE: Esc after typing cancels cleanly, no discard question", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("open delete"));
    const input = await screen.findByRole("textbox");
    fireEvent.input(input, { target: { value: "DEL" } });
    esc();
    await act(async () => {});
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("typed DELETE: backdrop click resolves the promise too", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("open delete"));
    const input = await screen.findByRole("textbox");
    fireEvent.input(input, { target: { value: "x" } });
    fireEvent.mouseDown(document.querySelector(".modal-backdrop")!);
    await act(async () => {});
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("typed DELETE still confirms when the word is typed", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("open delete"));
    const input = await screen.findByRole("textbox");
    const button = screen.getByRole("button", { name: "Delete account" });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "delete" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await act(async () => {});
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("clean form closes on Esc without asking", async () => {
    setup();
    fireEvent.click(screen.getByText("open form"));
    await screen.findByRole("dialog");
    esc();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("search-only input does not make the form dirty", async () => {
    setup();
    fireEvent.click(screen.getByText("open form"));
    fireEvent.input(await screen.findByLabelText("find"), {
      target: { value: "abc" },
    });
    esc();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dirty form: Esc asks; Esc on the question keeps editing; question works again; Cancel keeps; Discard closes", async () => {
    setup();
    fireEvent.click(screen.getByText("open form"));
    fireEvent.input(await screen.findByLabelText("amount"), {
      target: { value: "5" },
    });
    esc();
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    // Esc inside the question closes only the question.
    esc();
    await act(async () => {});
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.getByLabelText("amount")).toBeInTheDocument();
    // Not stuck: the question can be asked again.
    esc();
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.getByLabelText("amount")).toBeInTheDocument();
    esc();
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("session unreachable flow", () => {
  const user = { id: "u1", name: "Test User", email: "t@example.test" };
  const mount = () =>
    render(
      <SessionProvider>
        <WorkspaceLayout>
          <p>page content</p>
        </WorkspaceLayout>
      </SessionProvider>,
    );

  it("a 503 on /me keeps the session and offers retry and sign out", async () => {
    saveSession({ access_token: "t" }, true);
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) =>
        /\/api\/v1\/me$/.test(url)
          ? json(503, { error: { message: "x" } })
          : json(200, {}),
      );
    vi.stubGlobal("fetch", fetchMock);
    mount();
    expect(
      await screen.findByText(/couldn.t open your ledger/i),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(hasSession()).toBe(true);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("Try again recovers once the API answers", async () => {
    saveSession({ access_token: "t" }, true);
    let healthy = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (/\/api\/v1\/me$/.test(url))
          return healthy
            ? json(200, user)
            : json(503, { error: { message: "x" } });
        return json(200, { unread_count: 0, data: [] });
      }),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    healthy = true;
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("page content")).toBeInTheDocument();
  });

  it("a real 401 (refresh rejected) still redirects to login", async () => {
    saveSession({ access_token: "t" }, true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json(401, {
          error: { code: "UNAUTHORIZED", message: "authentication required" },
        }),
      ),
    );
    mount();
    await vi.waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fwallet"),
    );
    expect(hasSession()).toBe(false);
  });

  it("Sign out works even when the server cannot be reached", async () => {
    saveSession({ access_token: "t" }, true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (/\/api\/v1\/me$/.test(url))
          return json(503, { error: { message: "x" } });
        throw new TypeError("Failed to fetch");
      }),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(hasSession()).toBe(false);
  });
});

describe("planned skip queue", () => {
  const item = (id: string, title: string): PlannedItem =>
    ({
      id,
      type: "EXPENSE",
      account_id: null,
      to_account_id: null,
      amount: 1000,
      currency: "NPR",
      to_amount: null,
      category_id: null,
      title,
      description: "",
      occurred_at: null,
      due_at: "2026-01-01T00:00:00Z",
      source: "MANUAL",
      plan: null,
    }) as unknown as PlannedItem;
  const OVERDUE = [item("a", "Rent"), item("b", "Gym")];
  const calls = () =>
    vi.mocked(fetch).mock.calls.map(([url, init]) => ({
      url: String(url),
      init: init as RequestInit,
    }));
  const skipCalls = () => calls().filter((c) => /\/skip$/.test(c.url));

  const mount = () => {
    saveSession({ access_token: "tok" }, true);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async (url: string) =>
          /skip-overdue/.test(url)
            ? json(200, { skipped: 1 })
            : json(200, { next: null }),
        ),
    );
    return render(
      <ConfirmationProvider>
        <PlannedPanel
          overdue={OVERDUE}
          accounts={[]}
          categories={[]}
          tags={[]}
          baseCurrency="NPR"
          onChanged={vi.fn()}
        />
      </ConfirmationProvider>,
    );
  };

  it("hides the row, says it is pending, and sends after 6s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip Rent" }));
    expect(screen.queryByRole("button", { name: "Skip Rent" })).toBeNull();
    expect(screen.getByText(/Skipping “Rent” in 6s/)).toBeInTheDocument();
    expect(skipCalls()).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(skipCalls()).toHaveLength(1);
  });

  it("Undo restores the row and sends nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip Rent" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.getByRole("button", { name: "Skip Rent" }),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(skipCalls()).toHaveLength(0);
  });

  it("pagehide sends the queued skip at once with keepalive, auth and an idempotency key", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip Rent" }));
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    const sent = skipCalls();
    expect(sent).toHaveLength(1);
    expect(sent[0].init.keepalive).toBe(true);
    const headers = new Headers(sent[0].init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(headers.get("Idempotency-Key")).toMatch(/[0-9a-f-]{36}/);
    // The timer must not send it a second time.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(skipCalls()).toHaveLength(1);
  });

  it("hiding the tab flushes too", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip Gym" }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    expect(skipCalls()).toHaveLength(1);
    expect(skipCalls()[0].init.keepalive).toBe(true);
  });

  it("Skip then Skip all overdue: the queued skip is sent first, the count is right, no fake Undo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip Rent" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip all overdue" }));
    // Confirmation counts only what is still overdue (Gym), not Rent.
    expect(
      await screen.findByText("Skip 1 overdue item?", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(skipCalls()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Skip all overdue",
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    // Exactly one single-skip request ever, then the bulk one.
    expect(skipCalls()).toHaveLength(1);
    expect(calls().filter((c) => /skip-overdue/.test(c.url))).toHaveLength(1);
    const order = calls().map((c) =>
      /skip-overdue/.test(c.url)
        ? "bulk"
        : /skip$/.test(c.url)
          ? "one"
          : "other",
    );
    expect(order.indexOf("one")).toBeLessThan(order.indexOf("bulk"));
  });
});
