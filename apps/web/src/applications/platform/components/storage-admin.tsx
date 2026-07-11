import { useQuery } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, Metric, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";

// Storage inventory. Derived from the database (GET /platform/storage) - counts of stored
// artifacts by kind plus whether the object store is configured. Byte-level usage arrives when
// the object store exposes a metering API; this reports what the platform can account for today.

interface StorageItem {
  kind: string;
  count: number;
}

interface StorageInventory {
  configured: boolean;
  totalObjects: number;
  items: StorageItem[];
}

export function StorageAdmin() {
  const { data, isLoading, isError } = useQuery<StorageInventory>({
    queryKey: ["platform", "storage"],
    queryFn: () => api.get("/platform/storage"),
  });

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="Storage" description="Object-storage status and document/artifact inventory." />
      <PageBody className="space-y-6">
        {isError ? (
          <Card className="p-6">
            <EmptyState
              icon={<HardDrive className="h-5 w-5" />}
              title="Couldn't load storage inventory"
              description="The storage endpoint returned an error. Confirm platform super-admin access."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-3 h-6 w-10" />
                  </div>
                ))
              ) : (
                <>
                  <Metric label="Tracked objects" value={data?.totalObjects ?? 0} />
                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Object store
                    </div>
                    <div className="mt-2">
                      <Badge tone={data?.configured ? "success" : "warning"}>
                        {data?.configured ? "Configured" : "Not configured"}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <CardHeader title="Inventory by kind" subtitle="Artifacts the platform stores, grouped by type." />
              {isLoading ? (
                <div className="p-5 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : items.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<HardDrive className="h-5 w-5" />}
                    title="No stored artifacts"
                    description="The platform has no tracked documents or artifacts yet."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.kind} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-[13px] text-foreground">{item.kind}</span>
                      <span className="text-[12px] tabular-nums text-muted-foreground">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
