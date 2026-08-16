import { useState } from "react";
import { Button } from "@brim/ui-kit/button";
import { Input } from "@brim/ui-kit/input";
import { Select } from "@brim/ui-kit/select";
import { Dialog, Popover } from "@brim/ui-kit/dialog";
import { PumpReadout } from "@brim/ui-kit";
import { Command, Drawer, Form, Skeleton, Tabs, Toast, Tooltip } from "@brim/ui-kit";

export function KitchenSink() {
  const [tab, setTab] = useState("Readout");
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="display mb-2 text-3xl">Kitchen sink</h1>
      <p className="mb-6 opacity-80">If this looks like a stock shadcn demo, the tokens failed.</p>
      <Tabs tabs={["Readout", "Controls"]} value={tab} onChange={setTab} />
      <div className="grid gap-8">
        <section>
          <h2 className="mb-2">Pump readout magnitudes</h2>
          <PumpReadout value={4} />
          <PumpReadout value={47} />
          <PumpReadout value={412} />
        </section>
        <Form className="max-w-sm">
          <label>
            Origin
            <Input defaultValue="Crawley" />
          </label>
          <label>
            Propulsion
            <Select defaultValue="petrol">
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
            </Select>
          </label>
          <Tooltip label="Amber is reserved for the total">
            <Button type="button">Primary control</Button>
          </Tooltip>
          <Button type="button" variant="ghost" className="ml-2" onClick={() => setOpen(true)}>
            Open dialog
          </Button>
        </Form>
        <Popover>Popover surface — 2px corners, no shadow.</Popover>
        <Command>Command list placeholder</Command>
        <Skeleton className="w-48" />
        <Toast message="Saved. Your car is on this device." />
        <Drawer open={false}>Drawer</Drawer>
        <Dialog open={open} title="Not a template" onClose={() => setOpen(false)}>
          <p>Sharp corners, five colours, dark only.</p>
        </Dialog>
        <p className="tabular">£38–£47</p>
      </div>
      <p className="mt-8">
        <a href="/" className="underline">
          Back to estimate
        </a>
      </p>
    </main>
  );
}
