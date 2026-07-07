import { useState } from "react";
import { CardHeader } from "@grovyn/ui/primitives";
import { CheckInsTab } from "./data-management/check-ins-tab";
import { RecognitionsTab } from "./data-management/recognitions-tab";
import { ReviewsTab } from "./data-management/reviews-tab";
import { GoalsTab } from "./data-management/goals-tab";
import { NotificationsTab } from "./data-management/notifications-tab";

const dataTabs = [
  { id: "checkins", label: "Check-ins" },
  { id: "recognitions", label: "Recognitions" },
  { id: "reviews", label: "Reviews" },
  { id: "goals", label: "Goals" },
  { id: "notifications", label: "Notifications" },
] as const;

type DataTabId = (typeof dataTabs)[number]["id"];

export function AdministrationSection() {
  const [tab, setTab] = useState<DataTabId>("checkins");

  return (
    <div className="space-y-4">
      <div>
        <CardHeader
          title="Data Management"
          subtitle="Permanently delete check-ins, recognitions, reviews, goals, and notifications across the organization."
        />
        <div className="mt-3 flex flex-wrap gap-1 border-b border-border">
          {dataTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "checkins" && <CheckInsTab />}
      {tab === "recognitions" && <RecognitionsTab />}
      {tab === "reviews" && <ReviewsTab />}
      {tab === "goals" && <GoalsTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}
