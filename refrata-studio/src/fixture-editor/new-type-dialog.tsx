import { settings } from "@refrata/core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface NewType {
  readonly manufacturer: string;
  readonly model: string;
  readonly channels: number;
}

/** Asks what a new Fixture Type is called and how many Channels it starts with; its key is made from the two names and stays. */
export function NewTypeDialog({
  open,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (made: NewType) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open && <NewTypeForm onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function NewTypeForm({
  onClose,
  onSubmit,
}: {
  readonly onClose: () => void;
  readonly onSubmit: (made: NewType) => void;
}) {
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [channels, setChannels] = useState("1");
  const count = Number.parseInt(channels, 10);
  const valid =
    manufacturer.trim() !== "" &&
    model.trim() !== "" &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= settings.fixtureTypes.maxNewChannels;
  return (
    <DialogContent>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onClose();
          onSubmit({
            manufacturer: manufacturer.trim(),
            model: model.trim(),
            channels: count,
          });
        }}
      >
        <DialogHeader>
          <DialogTitle>New Fixture Type</DialogTitle>
          <DialogDescription>
            One Mode with that many one-byte Channels. Its key is made from the
            two names and stays.
          </DialogDescription>
        </DialogHeader>
        <Label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Manufacturer</span>
          <Input
            autoFocus
            value={manufacturer}
            onChange={(event) => setManufacturer(event.currentTarget.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Model</span>
          <Input
            value={model}
            onChange={(event) => setModel(event.currentTarget.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Channels</span>
          <Input
            inputMode="numeric"
            className="w-24"
            value={channels}
            onChange={(event) => setChannels(event.currentTarget.value)}
          />
        </Label>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid}>
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
