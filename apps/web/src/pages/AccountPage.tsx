import { useState, type FormEvent } from "react";
import { Button } from "@brim/ui-kit/button";
import { Input } from "@brim/ui-kit/input";
import { api, apiBase } from "../api.js";

export function AccountPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    await api("/v1/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
    setMessage("Account created. Vehicles saved on this device are now on the account.");
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    await api("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setMessage("Signed in.");
  }

  return (
    <main className="mx-auto max-w-xl p-4">
      <p>
        <a href="/" className="underline">
          Back
        </a>
      </p>
      <h1 className="display mb-4 text-3xl">Account</h1>
      <form onSubmit={(e) => void onSignup(e)} className="mb-6">
        <label>
          Email
          <Input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
        </label>
        <label>
          Password
          <Input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} minLength={8} required />
        </label>
        <Button type="submit">Create account</Button>
      <Button
        type="button"
        variant="ghost"
        className="ml-2"
        onClick={() => void onLogin({ preventDefault() {} } as FormEvent)}
      >
        Sign in
      </Button>
      </form>
      <Button type="button" variant="ghost" onClick={() => void api("/v1/auth/logout", { method: "POST" })}>
        Sign out
      </Button>
      <p className="mt-4">
        <a className="underline" href={`${apiBase}/v1/auth/export`}>
          Download all data
        </a>
      </p>
      <Button
        type="button"
        variant="warning"
        className="mt-4"
        onClick={async () => {
          if (!confirm("Delete your account and stored journeys permanently?")) return;
          await api("/v1/auth/account", { method: "DELETE" });
          setMessage("Account deleted.");
        }}
      >
        Delete account
      </Button>
      {message ? <p className="mt-4">{message}</p> : null}
    </main>
  );
}
