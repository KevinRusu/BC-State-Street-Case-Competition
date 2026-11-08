import { DatabaseZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreMissing({ file }: { file: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZap className="size-5 text-status-warn" /> No store built yet
          </CardTitle>
          <CardDescription>The app reads one file, built by Python from the data and the deliverable notebook&apos;s register.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>From the repo root:</p>
          <pre className="rounded-md bg-muted p-3 font-mono text-xs">
            tests/run_notebook.sh{"\n"}uv run python scripts/build_store.py
          </pre>
          <p className="text-muted-foreground">
            Looked for <span className="font-mono break-all">{file}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
