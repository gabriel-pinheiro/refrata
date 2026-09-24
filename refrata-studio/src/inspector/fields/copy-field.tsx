import { ExternalLink, Link } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyWithToast } from "@/lib/copy-text";

/** A read-only value with a copy button and, when given, a link that opens it. */
export function CopyField({
  label,
  description,
  value,
  openHref,
}: {
  readonly label: string;
  readonly description?: string;
  readonly value: string;
  readonly openHref?: string;
}) {
  function copy(): void {
    copyWithToast(value, `${label} copied`);
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
      <Label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Input readOnly value={value} className="font-mono text-[0.625rem]" />
      </Label>
      {description !== undefined && (
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={copy}>
          <Link /> Copy
        </Button>
        {openHref !== undefined && (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={openHref} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink /> Open
          </Button>
        )}
      </div>
    </div>
  );
}
