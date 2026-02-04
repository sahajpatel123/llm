"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  email: string;
  plan?: string | null;
  status?: string | null;
};

type Thread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type AuthMode = "login" | "signup";

type ApiError = {
  ok: false;
  error: string;
};

type DuelState = {
  id: string;
  left: { text: string; key: "A" | "B" };
  right: { text: string; key: "A" | "B" };
};

type QuotaState = {
  plan: "A1" | "A2";
  subscriptionStatus: "active" | "inactive";
  periodKey: string;
  remainingMessages: number;
  remainingVerified: number;
  remainingVerifiedToday: number;
};

type BillingPlan = "A1" | "A2";

type OrderResponse = {
  ok: true;
  plan: BillingPlan;
  order: { id: string; amount: number; currency: string };
  publicKey: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => {
  open: () => void;
};

const MAX_MESSAGE_LENGTH = 8000;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getErrorCode(data: unknown) {
  if (data && typeof data === "object" && "error" in data) {
    return (data as { error?: string }).error ?? "unknown";
  }
  return "unknown";
}

function loadCheckoutScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no_window"));
    if (document.querySelector("script[data-checkout='billing']")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.checkout = "billing";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script_failed"));
    document.body.appendChild(script);
  });
}

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [mode, setMode] = useState<"exploration" | "verified">("exploration");
  const [uiError, setUiError] = useState<string | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [sending, setSending] = useState(false);
  const [duelLoading, setDuelLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoScrollRef = useRef(true);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const verifiedDisabled = Boolean(
    quota && (quota.remainingVerified <= 0 || quota.remainingVerifiedToday <= 0),
  );

  const inputTooLong = messageInput.length > MAX_MESSAGE_LENGTH;

  async function loadMe() {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as { authenticated: boolean; user?: User };
    if (data.authenticated && data.user) {
      setUser(data.user);
      return data.user;
    }
    setUser(null);
    return null;
  }

  async function loadThreads() {
    const res = await fetch("/api/threads", { credentials: "include" });
    if (res.status === 401) {
      setUser(null);
      setThreads([]);
      return;
    }
    const data = (await res.json()) as { ok: boolean; threads?: Thread[] } | ApiError;
    if ("threads" in data && Array.isArray(data.threads)) {
      setThreads(data.threads);
    }
  }

  async function loadMessages(threadId: string) {
    setMessagesLoading(true);
    const res = await fetch(`/api/threads/${threadId}/messages`, { credentials: "include" });
    if (res.status === 401) {
      setMessages([]);
      setAuthOpen(true);
      setMessagesLoading(false);
      return;
    }
    const data = (await res.json()) as { ok: boolean; messages?: Message[] } | ApiError;
    if ("messages" in data && Array.isArray(data.messages)) {
      setMessages(data.messages);
    }
    setMessagesLoading(false);
  }

  async function loadQuota() {
    const res = await fetch("/api/quota", { credentials: "include" });
    if (res.status === 401) {
      setQuota(null);
      return;
    }
    const data = (await res.json()) as { ok: boolean } & Partial<QuotaState>;
    if (data.ok) {
      setQuota({
        plan: data.plan ?? "A1",
        subscriptionStatus: data.subscriptionStatus ?? "inactive",
        periodKey: data.periodKey ?? "",
        remainingMessages: data.remainingMessages ?? 0,
        remainingVerified: data.remainingVerified ?? 0,
        remainingVerifiedToday: data.remainingVerifiedToday ?? 0,
      });
    }
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });

    const data = (await res.json()) as { ok: boolean; user?: User; error?: string };
    if (!res.ok) {
      setAuthError(data.error ?? "Something went wrong");
      setAuthLoading(false);
      return;
    }

    setUser(data.user ?? null);
    setAuthOpen(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthLoading(false);
    await loadThreads();
    await loadQuota();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setThreads([]);
    setSelectedThreadId(null);
    setMessages([]);
    setDuel(null);
    setQuota(null);
  }

  function handleNewChat() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSelectedThreadId(null);
    setMessages([]);
    setDuel(null);
    setUiError(null);
  }

  async function handleThreadSelect(threadId: string) {
    setSelectedThreadId(threadId);
    setDuel(null);
    await loadMessages(threadId);
  }

  async function handleThreadDelete(threadId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const confirmed = window.confirm("Delete this chat?");
    if (!confirmed) return;

    const res = await fetch(`/api/threads/${threadId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return;
    }

    setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
      setMessages([]);
      setDuel(null);
    }
  }

  function mapError(code: string) {
    if (code === "quota_exceeded") return "Message limit reached.";
    if (code === "verified_quota_exceeded") return "Verified limit reached.";
    if (code === "verified_daily_limit") return "Daily verified limit reached.";
    if (code === "provider_not_configured") return "Service not configured.";
    if (code === "provider_error") return "Service error.";
    if (code === "rate_limited") return "Too many requests.";
    return "Something went wrong.";
  }

  async function handleSend() {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    const content = messageInput.trim();
    if (!content) return;
    if (inputTooLong) {
      setUiError("Message too long.");
      return;
    }

    setSending(true);
    setDuelLoading(!selectedThreadId || messages.length === 0);
    setUiError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        threadId: selectedThreadId ?? undefined,
        content,
        mode,
      }),
    });

    if (res.status === 401) {
      setAuthOpen(true);
      setSending(false);
      setDuelLoading(false);
      return;
    }

    const data = (await res.json()) as
      | ApiError
      | {
          ok: true;
          kind: "duel" | "single";
          thread: { id: string; title: string; lockedProvider: "A" | "B" | null };
          duel?: DuelState;
          messages: Message[];
        };

    if (!res.ok) {
      setUiError(mapError(getErrorCode(data)));
      setSending(false);
      setDuelLoading(false);
      return;
    }

    if (!("kind" in data)) {
      setUiError("Something went wrong.");
      setSending(false);
      setDuelLoading(false);
      return;
    }

    if (data.kind === "duel" && data.duel) {
      setDuel(data.duel);
      setMessages(data.messages);
      setSelectedThreadId(data.thread.id);
    } else {
      setDuel(null);
      setMessages(data.messages);
      setSelectedThreadId(data.thread.id);
    }

    setMessageInput("");
    await loadThreads();
    await loadQuota();
    setSending(false);
    setDuelLoading(false);
    inputRef.current?.focus();
  }

  async function handleVote(choice: "A" | "B") {
    if (!duel) return;
    setVoteLoading(true);

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ duelId: duel.id, choice }),
    });

    if (res.status === 401) {
      setAuthOpen(true);
      setVoteLoading(false);
      return;
    }

    const data = (await res.json()) as ApiError | { ok: true; messages: Message[] };
    if (!res.ok) {
      setUiError(mapError(getErrorCode(data)));
      setVoteLoading(false);
      return;
    }

    if (!("messages" in data)) {
      setUiError("Something went wrong.");
      setVoteLoading(false);
      return;
    }

    setDuel(null);
    setMessages(data.messages);
    await loadThreads();
    await loadQuota();
    setVoteLoading(false);
  }

  async function handleUpgrade(plan: BillingPlan) {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    setBillingLoading(true);
    setBillingError(null);

    const res = await fetch("/api/billing/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan }),
    });

    const data = (await res.json()) as ApiError | OrderResponse;

    if (!res.ok) {
      const code = getErrorCode(data);
      setBillingError(code === "billing_not_configured" ? "Billing not configured" : "Billing error");
      setBillingLoading(false);
      return;
    }

    if (!("publicKey" in data)) {
      setBillingError("Billing error");
      setBillingLoading(false);
      return;
    }

    try {
      await loadCheckoutScript();
      const RazorpayCtor = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
      const checkout = new RazorpayCtor({
        key: data.publicKey,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Blank",
        order_id: data.order.id,
        handler: async (response: RazorpayHandlerResponse) => {
          const verifyRes = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              plan,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });

          const verifyData = (await verifyRes.json()) as ApiError | { ok: true };
          if (!verifyRes.ok) {
            const code = getErrorCode(verifyData);
            setBillingError(code === "payment_verification_failed" ? "Payment verification failed" : "Billing error");
            return;
          }

          setBillingOpen(false);
          await loadMe();
          await loadQuota();
        },
      });
      checkout.open();
    } catch {
      setBillingError("Billing error");
    }

    setBillingLoading(false);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => setInstallPrompt(null));
  }

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  useEffect(() => {
    loadMe().then((activeUser) => {
      if (activeUser) {
        loadThreads();
        loadQuota();
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    if (verifiedDisabled && mode === "verified") {
      setMode("exploration");
    }
  }, [verifiedDisabled, mode]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    if (!autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, duel, duelLoading]);

  function handleChatScroll() {
    const el = chatRef.current;
    if (!el) return;
    const threshold = 120;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    autoScrollRef.current = nearBottom;
  }

  return (
    <div className="flex h-screen bg-white text-black">
      <aside
        className={classNames(
          sidebarOpen ? "block" : "hidden",
          "sm:block w-[280px] border-r border-gray-200 bg-white",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">
            History
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3 text-sm">
            {!user ? (
              <div className="px-2 text-gray-600">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="px-2 text-gray-500">No chats yet</div>
            ) : (
              <ul className="space-y-1">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <div
                      className={classNames(
                        "flex items-center justify-between rounded border border-transparent px-2 py-2",
                        selectedThreadId === thread.id
                          ? "border-gray-300 bg-gray-50"
                          : "hover:bg-gray-50",
                      )}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left text-xs"
                        onClick={() => handleThreadSelect(thread.id)}
                      >
                        {thread.title}
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-[10px] text-gray-500"
                        onClick={() => handleThreadDelete(thread.id)}
                        aria-label="Delete chat"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {user ? (
            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
              <div className="truncate">{user.email}</div>
              {quota ? (
                <div className="mt-2 space-y-1 text-[10px] text-gray-500">
                  <div>Plan {quota.plan}</div>
                  <div>Messages left: {quota.remainingMessages}</div>
                  <div>Verified left: {quota.remainingVerified}</div>
                  <div>Verified today: {quota.remainingVerifiedToday}</div>
                </div>
              ) : null}
              {quota?.subscriptionStatus === "inactive" ? (
                <button
                  type="button"
                  className="mt-3 rounded border border-gray-300 px-2 py-1 text-[10px]"
                  onClick={() => setBillingOpen(true)}
                >
                  Upgrade
                </button>
              ) : null}
              {installPrompt ? (
                <button
                  type="button"
                  className="mt-2 rounded border border-gray-300 px-2 py-1 text-[10px]"
                  onClick={handleInstall}
                >
                  Install
                </button>
              ) : null}
              <button
                type="button"
                className="mt-2 rounded border border-gray-300 px-2 py-1 text-[10px]"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="relative flex-1">
        <div className="flex items-start justify-between px-4 py-3">
          <button
            type="button"
            className="sm:hidden rounded border border-gray-300 px-2 py-1 text-xs"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle history"
          >
            Menu
          </button>
          <div className="ml-auto">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              onClick={handleNewChat}
            >
              New chat
            </button>
          </div>
        </div>

        <div
          className="px-6 pb-28 pt-6 text-sm"
          ref={chatRef}
          onScroll={handleChatScroll}
        >
          {duelLoading ? (
            <div className="text-gray-500">Generating options...</div>
          ) : duel ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-gray-200 p-4">
                <div className="whitespace-pre-wrap text-sm text-black">{duel.left.text}</div>
                <button
                  type="button"
                  className="mt-3 rounded border border-gray-300 px-3 py-1 text-xs"
                  onClick={() => handleVote(duel.left.key)}
                  disabled={voteLoading}
                >
                  {voteLoading ? "Applying..." : "Select"}
                </button>
              </div>
              <div className="rounded border border-gray-200 p-4">
                <div className="whitespace-pre-wrap text-sm text-black">{duel.right.text}</div>
                <button
                  type="button"
                  className="mt-3 rounded border border-gray-300 px-3 py-1 text-xs"
                  onClick={() => handleVote(duel.right.key)}
                  disabled={voteLoading}
                >
                  {voteLoading ? "Applying..." : "Select"}
                </button>
              </div>
            </div>
          ) : !selectedThread ? (
            <div className="text-gray-500">Start a chat</div>
          ) : messagesLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-gray-500">Send a message</div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={classNames(
                    "rounded border border-gray-200 px-3 py-2",
                    message.role === "user" ? "bg-white" : "bg-gray-50",
                  )}
                >
                  <div className="text-xs text-gray-500">
                    {message.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-black">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          {uiError ? <div className="mt-4 text-xs text-red-600">{uiError}</div> : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex w-full flex-1 flex-col gap-1">
              <textarea
                ref={inputRef}
                rows={2}
                placeholder="Type a message"
                className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>{inputTooLong ? "Too long" : ""}</span>
                <span>{messageInput.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded border border-gray-300 p-1 text-xs">
                <button
                  type="button"
                  className={classNames(
                    "rounded px-2 py-1",
                    mode === "exploration" ? "bg-black text-white" : "text-black",
                  )}
                  onClick={() => setMode("exploration")}
                >
                  Exploration
                </button>
                <button
                  type="button"
                  className={classNames(
                    "rounded px-2 py-1",
                    mode === "verified" ? "bg-black text-white" : "text-black",
                    verifiedDisabled ? "opacity-50" : "",
                  )}
                  onClick={() => setMode("verified")}
                  disabled={verifiedDisabled}
                >
                  Verified
                </button>
              </div>
              <button
                type="button"
                className={classNames(
                  "rounded border border-gray-300 px-3 py-2 text-sm",
                  !messageInput.trim() || inputTooLong ? "text-gray-400" : "text-black",
                )}
                disabled={!messageInput.trim() || sending || inputTooLong}
                onClick={handleSend}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {authOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/90 px-4">
          <div className="w-full max-w-sm rounded border border-gray-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Sign in</div>
              <button
                type="button"
                className="text-xs text-gray-500"
                onClick={() => setAuthOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                type="button"
                className={classNames(
                  "rounded border px-2 py-1",
                  authMode === "login" ? "border-black" : "border-gray-300",
                )}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={classNames(
                  "rounded border px-2 py-1",
                  authMode === "signup" ? "border-black" : "border-gray-300",
                )}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleAuthSubmit}>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Email</label>
                <input
                  type="email"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Password</label>
                <input
                  type="password"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  required
                />
              </div>
              {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
              <button
                type="submit"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={authLoading}
              >
                {authMode === "login" ? "Login" : "Sign up"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {billingOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/90 px-4">
          <div className="w-full max-w-md rounded border border-gray-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Upgrade</div>
              <button
                type="button"
                className="text-xs text-gray-500"
                onClick={() => setBillingOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-gray-200 p-3">
                <div className="text-sm font-semibold">Plan A1</div>
                <div className="mt-1 text-xs text-gray-500">₹99 / 30 days</div>
                <div className="mt-2 text-[11px] text-gray-600">400 messages / 15 verified</div>
                <button
                  type="button"
                  className="mt-3 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  onClick={() => handleUpgrade("A1")}
                  disabled={billingLoading}
                >
                  Pay via UPI
                </button>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-sm font-semibold">Plan A2</div>
                <div className="mt-1 text-xs text-gray-500">₹199 / 30 days</div>
                <div className="mt-2 text-[11px] text-gray-600">900 messages / 45 verified</div>
                <button
                  type="button"
                  className="mt-3 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  onClick={() => handleUpgrade("A2")}
                  disabled={billingLoading}
                >
                  Pay via UPI
                </button>
              </div>
            </div>
            {billingError ? <div className="mt-3 text-xs text-red-600">{billingError}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
