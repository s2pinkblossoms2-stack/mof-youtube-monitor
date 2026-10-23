"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "" });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm text-muted">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-brand-line bg-white px-3 py-2 text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-4 py-2.5 text-white disabled:opacity-50"
      >
        {pending ? "확인하는 중…" : "들어가기"}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-red-600">
        {state.error}
      </p>
    </form>
  );
}
