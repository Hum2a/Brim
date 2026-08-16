import { useEffect, useState } from "react";
import { Button } from "@brim/ui-kit/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@brim/ui-kit/dialog";
import {
  HERALD_OPEN_EVENT,
  WHATS_NEW,
  markHeraldSeen,
  unseenHeraldEntries,
  type HeraldEntry,
} from "./whats-new.js";

export function HeraldDialog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HeraldEntry[]>([]);

  useEffect(() => {
    const unseen = unseenHeraldEntries();
    if (unseen.length > 0) {
      setEntries(unseen);
      setOpen(true);
    }
    function onOpen() {
      setEntries(WHATS_NEW);
      setOpen(true);
    }
    window.addEventListener(HERALD_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(HERALD_OPEN_EVENT, onOpen);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) markHeraldSeen(entries);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>Changes already in this copy of Brim.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <p className="tabular text-xs text-mist">{entry.date}</p>
              <p className="text-sm text-pump">{entry.title}</p>
              <p className="text-sm text-mist">{entry.body}</p>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            markHeraldSeen(entries);
            setOpen(false);
          }}
        >
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
