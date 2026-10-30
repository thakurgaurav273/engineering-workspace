import {
  useTemplateChoices,
  type TemplateChoice,
  type TemplatedType,
} from "@/applications/business/lib/business-document-templates";

/**
 * Picks the published template a document renders with. "" = the org default (resolved at
 * render time, so it follows later default changes). Renders nothing while the org has only
 * one choice - there is nothing to pick.
 */
export function TemplateSelect({
  documentType,
  value,
  onChange,
  className,
  label,
}: {
  documentType: TemplatedType;
  value: string;
  onChange: (templateId: string, choice: TemplateChoice | undefined) => void;
  className?: string;
  /** Wraps the select (e.g. the form's label component); receives the select element. */
  label: (select: React.ReactNode) => React.ReactNode;
}) {
  const { data: choices } = useTemplateChoices(documentType);
  if (!choices || (choices.length < 2 && !value)) return null;
  const fallback = choices.find((c) => c.isDefault);
  return label(
    <select
      className={className}
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        onChange(
          id,
          choices.find((c) => c.id === (id || fallback?.id)),
        );
      }}
    >
      <option value="">{fallback ? `Default (${fallback.name})` : "Default layout"}</option>
      {choices
        .filter((c) => !c.isDefault)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </select>,
  );
}
