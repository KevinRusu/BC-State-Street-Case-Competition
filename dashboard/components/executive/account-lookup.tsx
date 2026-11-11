import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Opens any account by its ID; a plain GET form, so it works without JavaScript. */
export function AccountLookup() {
  return (
    <form method="get" action="/executive/account" className="flex max-w-md gap-2">
      <Input name="id" aria-label="Account ID" placeholder="Account ID" className="font-mono" required />
      <Button type="submit">Open account</Button>
    </form>
  );
}
