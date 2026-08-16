import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import {
  PumpReadout,
  ReducedMotionProvider,
  fadeUp,
  motionSafe,
  usePrefersReducedMotion,
} from '@brim/ui-kit';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@brim/ui-kit/accordion';
import { Badge } from '@brim/ui-kit/badge';
import { Button } from '@brim/ui-kit/button';
import { Card } from '@brim/ui-kit/card';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@brim/ui-kit/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@brim/ui-kit/dialog';
import { Drawer, DrawerContent, DrawerTrigger } from '@brim/ui-kit/drawer';
import { Form, FormItem } from '@brim/ui-kit/form';
import { Input } from '@brim/ui-kit/input';
import { Label } from '@brim/ui-kit/label';
import { Popover, PopoverContent, PopoverTrigger } from '@brim/ui-kit/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@brim/ui-kit/select';
import { Separator } from '@brim/ui-kit/separator';
import { Sheet, SheetContent, SheetTrigger } from '@brim/ui-kit/sheet';
import { Skeleton } from '@brim/ui-kit/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@brim/ui-kit/tabs';
import { toast } from '@brim/ui-kit/toast';
import { Hint } from '@brim/ui-kit/tooltip';

function MotionLab() {
  const reduce = usePrefersReducedMotion();
  const [scene, setScene] = useState<'estimate' | 'history'>('estimate');
  const transition = motionSafe(reduce, fadeUp);

  return (
    <div className="grid gap-6">
      <Card>
        <p className="mb-3 text-sm text-mist">
          Route-style fade. With reduced motion this snaps; otherwise it fades 8px.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setScene((s) => (s === 'estimate' ? 'history' : 'estimate'))}
        >
          Swap scene
        </Button>
        <div className="relative mt-4 min-h-32">
          <AnimatePresence initial={false}>
            <m.div
              key={scene}
              initial={transition.initial}
              animate={transition.animate}
              exit={{ ...transition.exit, position: 'absolute', width: '100%' }}
              transition={transition.transition}
              className="rounded-[2px] border border-border bg-card p-5"
            >
              {scene === 'estimate' ? (
                <p className="display text-2xl">Estimate scene</p>
              ) : (
                <p className="display text-2xl">History scene</p>
              )}
              <p className="mt-2 text-sm text-mist">Nav ink glides with a transform. Pump count-up stays on Estimate.</p>
            </m.div>
          </AnimatePresence>
        </div>
      </Card>
      <Card className="grid gap-8 md:grid-cols-3">
        <PumpReadout value={4} />
        <PumpReadout value={47} />
        <PumpReadout value={412} />
      </Card>
    </div>
  );
}

export function KitchenSink() {
  const [open, setOpen] = useState(false);
  const [fuel, setFuel] = useState('petrol');
  const [snap, setSnap] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', snap);
    return () => document.documentElement.classList.remove('reduce-motion');
  }, [snap]);

  return (
    <ReducedMotionProvider value={snap ? true : null}>
      <main className="mx-auto w-[min(960px,calc(100%-1.5rem))] py-8">
        <h1 className="display mb-2 text-4xl">Kitchen sink</h1>
        <p className="mb-6 max-w-xl text-mist">
          Motion lab. Solid panels, 2px corners, pump count-up. If this looks like a stock animated
          dashboard, restyle it.
        </p>
        <label className="mb-8 flex max-w-md flex-row items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
            className="size-4 rounded-[2px] accent-[var(--gauge)]"
          />
          Snap motion (lab override of prefers-reduced-motion)
        </label>
        <Tabs defaultValue="readout">
          <TabsList>
            <TabsTrigger value="readout">Readout</TabsTrigger>
            <TabsTrigger value="motion">Motion</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>
          <TabsContent value="readout">
            <Card className="grid gap-8 md:grid-cols-3">
              <PumpReadout value={4} />
              <PumpReadout value={47} />
              <PumpReadout value={412} />
            </Card>
          </TabsContent>
          <TabsContent value="motion">
            <MotionLab />
          </TabsContent>
          <TabsContent value="controls">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <Form>
                  <FormItem>
                    <Label>Origin</Label>
                    <Input defaultValue="Crawley" />
                  </FormItem>
                  <FormItem>
                    <Label htmlFor="lab-password">Password</Label>
                    <Input
                      id="lab-password"
                      type="password"
                      defaultValue="forecourt"
                      autoComplete="off"
                    />
                  </FormItem>
                  <FormItem>
                    <Label>Propulsion</Label>
                    <Select value={fuel} onValueChange={setFuel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petrol">Petrol</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                  <Hint label="Amber is reserved for the total">
                    <Button type="button">Primary control</Button>
                  </Hint>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-2"
                    onClick={() => setOpen(true)}
                  >
                    Open dialog
                  </Button>
                </Form>
              </Card>
              <Card>
                <Command>
                  <CommandInput placeholder="Filter places" />
                  <CommandList>
                    <CommandEmpty>No place.</CommandEmpty>
                    <CommandItem>Crawley</CommandItem>
                    <CommandItem>London</CommandItem>
                  </CommandList>
                </Command>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2">
                  <Badge>Quiet</Badge>
                  <Badge variant="diesel">Compliant</Badge>
                  <Badge variant="warning">Stale</Badge>
                </div>
                <Skeleton className="mt-4 h-4 w-48" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" type="button">
                        Popover
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      Popover surface: 2px corners, solid panel.
                    </PopoverContent>
                  </Popover>
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="ghost" type="button">
                        Drawer
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent>Trip drawer. Sharp top edge.</DrawerContent>
                  </Drawer>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" type="button">
                        Sheet
                      </Button>
                    </SheetTrigger>
                    <SheetContent>Side panel.</SheetContent>
                  </Sheet>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => toast('Saved. Your car is on this device.')}
                  >
                    Toast
                  </Button>
                </div>
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="a">
                    <AccordionTrigger>How we got there</AccordionTrigger>
                    <AccordionContent>Used the consumption figure you entered.</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Not a template</DialogTitle>
            </DialogHeader>
            <p>Sharp corners, solid panels, dark only.</p>
          </DialogContent>
        </Dialog>
      </main>
    </ReducedMotionProvider>
  );
}
