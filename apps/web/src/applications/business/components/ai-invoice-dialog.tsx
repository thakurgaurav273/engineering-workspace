import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@grovyn/ui/components/dialog";
import { Button } from "@grovyn/ui/primitives";
import { useClients } from "@/applications/business/lib/business-clients";
import { useGenerateInvoice, type Invoice } from "@/applications/business/lib/business-invoices";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ring";

// AI-assisted invoice drafting. Turns a plain-language description into a DRAFT invoice the
// user then reviews/edits in the normal editor. Backed by /business/ai/invoices (Hugging Face).
export function AiInvoiceDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: (invoice: Invoice) => void;
}) {
  const { data: clientsPage } = useClients({ limit: 100 });
  const generate = useGenerateInvoice();
  const [clientId, setClientId] = useState("");
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    if (!clientId) return toast.error("Select a client");
    if (prompt.trim().length < 3) return toast.error("Describe what to invoice");
    generate.mutate(
      { clientId, prompt: prompt.trim() },
      {
        onSuccess: (res) => {
          if (!res.invoice) return toast.error("No draft was produced");
          toast.success(
            `Draft created${
              typeof res.confidence === "number"
                ? ` · ${Math.round(res.confidence * 100)}% confidence`
                : ""
            }`,
          );
          onOpenChange(false);
          setPrompt("");
          onGenerated(res.invoice);
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Couldn't generate a draft"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Draft an invoice with AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">Client *</span>
            <select
              className={inputCls}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client…</option>
              {clientsPage?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Describe the work
            </span>
            <textarea
              rows={5}
              className={inputCls}
              placeholder="e.g. 40 hours of React development at ₹2000/hr for the Q3 dashboard rebuild, plus a ₹15000 design retainer. 18% GST, due in 15 days."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <p className="text-[11.5px] text-muted-foreground">
            AI creates an editable draft - always review the lines, tax and totals before issuing.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={generate.isPending}>
            {generate.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Generate draft
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
