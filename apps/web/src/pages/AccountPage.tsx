import { m } from "motion/react";
import { useState, type FormEvent } from "react";
import { reveal, staggerChildren, usePrefersReducedMotion } from "@brim/ui-kit";
import { Button } from "@brim/ui-kit/button";
import { Card } from "@brim/ui-kit/card";
import { Form, FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { toast } from "@brim/ui-kit/toast";
import { api, apiBase } from "../api.js";

export function AccountPage() {
  const reduce = usePrefersReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    await api("/v1/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
    setMessage("Account created. Vehicles saved on this device are now on the account.");
    toast("Account created.");
  }

  async function onLogin() {
    await api("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setMessage("Signed in.");
    toast("Signed in.");
  }

  return (
    <main className="mx-auto w-[min(560px,calc(100%-1.5rem))] py-8">
      <m.div variants={staggerChildren} initial={reduce ? false : "initial"} animate="animate">
        <m.div variants={reveal}>
          <h1 className="display mb-6 text-4xl">Account</h1>
        </m.div>
        <m.div variants={reveal}>
          <Card>
            <Form onSubmit={(e) => void onSignup(e)}>
              <FormItem>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
              </FormItem>
              <FormItem>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  minLength={8}
                  required
                />
              </FormItem>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Create account</Button>
                <Button type="button" variant="ghost" onClick={() => void onLogin()}>
                  Sign in
                </Button>
              </div>
            </Form>
            <div className="mt-6 flex flex-col items-start gap-3">
              <Button type="button" variant="ghost" onClick={() => void api("/v1/auth/logout", { method: "POST" })}>
                Sign out
              </Button>
              <a className="text-sm underline" href={`${apiBase}/v1/auth/export`}>
                Download all data
              </a>
              <Button
                type="button"
                variant="warning"
                onClick={async () => {
                  if (!confirm("Delete your account and stored journeys permanently?")) return;
                  await api("/v1/auth/account", { method: "DELETE" });
                  setMessage("Account deleted.");
                  toast("Account deleted.");
                }}
              >
                Delete account
              </Button>
            </div>
            {message ? <p className="mt-4 text-sm text-mist">{message}</p> : null}
          </Card>
        </m.div>
      </m.div>
    </main>
  );
}
