-- Offer letter wording moves from Business Settings (OfferLetterTemplate) onto document
-- templates: each saved wording becomes a published offer-letter template carrying it as
-- defaultBody, so it can be picked on the offer form.

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "defaultBody" TEXT;

-- Migrate saved wordings. Layout = the org's current default offer-letter template if it has
-- one, else the built-in classic offer letter (embedded as it was at migration time).
CREATE TEMP TABLE "_offer_wording" AS
SELECT
  'olt_' || substr(md5(t."id"), 1, 21) AS "tid",
  'oltv_' || substr(md5(t."id"), 1, 20) AS "vid",
  t."orgId",
  t."employmentType",
  t."jobRole",
  t."content",
  'offer_' || lower(t."employmentType"::text)
    || CASE WHEN t."jobRole" = '' THEN '' ELSE '_' || trim(both '_' from regexp_replace(lower(t."jobRole"), '[^a-z0-9]+', '_', 'g')) END
    || '_' || substr(md5(t."id"), 1, 6) AS "key",
  (CASE t."employmentType"::text
     WHEN 'FULL_TIME' THEN 'Full-time' WHEN 'PART_TIME' THEN 'Part-time'
     WHEN 'CONTRACT' THEN 'Contract' ELSE 'Internship' END)
    || CASE WHEN t."jobRole" = '' THEN ' offer' ELSE ' offer · ' || t."jobRole" END AS "name",
  COALESCE(
    (SELECT v."html" FROM "DocumentTemplate" d
       JOIN "DocumentTemplateVersion" v ON v."templateId" = d."id" AND v."version" = d."liveVersion"
      WHERE d."orgId" = t."orgId" AND d."documentType" = 'OFFER_LETTER' AND d."isDefault"
      LIMIT 1),
    $starter$<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Offer Letter - {{ candidate.name }}</title>
  <!-- Page numbers in the footer: bottom-left | bottom-center | bottom-right (remove to hide). -->
  <meta name="page-numbers" content="bottom-right">
  <style>
    @page { size: A4; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #334155; }
    h1, h2, h3, p, ul, ol, table, tr { page-break-inside: avoid; }
    /* @page margins only apply to the PDF; give on-screen previews and emails the same breathing room. */
    @media screen { body { padding: 12mm; max-width: 210mm; margin: 0 auto; background: #fff; } }
    .ink { color: #0f172a; }
    .muted { color: #64748b; }
    .label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
    .letterhead { border-bottom: 4px solid #0f766e; padding-bottom: 14px; display: flex; justify-content: space-between; gap: 16px; }
    .letterhead .company { max-width: 46%; }
    .letterhead .logo { max-height: 44px; max-width: 160px; margin-bottom: 6px; display: block; }
    .letterhead .name { font-size: 20px; font-weight: 800; letter-spacing: -.02em; color: #0f172a; }
    .letterhead .meta { font-size: 11px; color: #64748b; margin-top: 2px; }
    .letterhead .title { font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: .02em; text-align: center; align-self: flex-start; }
    .letterhead .ref { text-align: right; white-space: nowrap; }
    .pill { display: inline-block; background: #f1f5f9; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #0f172a; }
    .dated { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .14em; margin-top: 8px; }
    .party { margin-top: 22px; display: flex; justify-content: space-between; gap: 24px; }
    .party .who { font-size: 12.5px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.items th { background: #f1f5f9; padding: 8px 6px; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; text-align: right; }
    table.items td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; text-align: right; vertical-align: top; }
    table.items th.left, table.items td.left { text-align: left; }
    table.items td.desc { color: #0f172a; }
    table.items .note { font-size: 10.5px; color: #64748b; margin-top: 2px; }
    table.totals { margin-left: auto; margin-top: 14px; border-collapse: collapse; }
    table.totals td { padding: 4px 0; font-size: 12px; text-align: right; }
    table.totals td + td { padding-left: 28px; white-space: nowrap; }
    table.totals tr.strong td { font-weight: 700; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    .words { text-align: right; font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic; }
    .section { margin-top: 22px; }
    .section h3 { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
    .section .body { margin-top: 6px; font-size: 12.5px; line-height: 1.55; }
    .block { margin-top: 18px; }
    .block .text { margin-top: 4px; }
    .columns { display: flex; gap: 24px; margin-top: 24px; }
    .columns > div { flex: 1; }
    .sign { margin-top: 30px; text-align: right; }
    .sign img { max-height: 56px; max-width: 220px; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="company">
      {% if company.logo_url != "" %}<img class="logo" src="{{ company.logo_url }}" alt="">{% endif %}
      <div class="name">{{ company.name }}</div>
      {% if company.address != "" %}<div class="meta">{{ company.address }}</div>{% endif %}
      {% if company.website != "" %}<div class="meta">{{ company.website }}</div>{% endif %}
      {% if company.gstin != "" %}<div class="meta">GSTIN: {{ company.gstin }}</div>{% endif %}
    </div>
    <div class="title">{{ document.title }}</div>
    <div class="ref">
      <span class="pill">#{{ document.number | default: "Draft" }}</span>
      <div class="dated">Dated {{ document.date | date_format }}</div>
    </div>
  </div>
  <div class="block" style="margin-top: 24px">
    <div class="ink"><strong>To,</strong></div>
    <div class="ink"><strong>{{ candidate.name }}</strong></div>
    {% if candidate.address != "" %}<div>{{ candidate.address | multiline }}</div>{% endif %}
    <div class="ink" style="margin-top: 16px; font-size: 13px"><strong>Subject: Offer of {% if offer.is_internship %}Internship{% else %}Employment{% endif %} - {{ offer.position }} at {{ company.name }}</strong></div>
  </div>

  <div class="block" style="font-size: 12.5px; line-height: 1.6">{{ offer.body | html }}</div>

  <div style="margin-top: 30px">
    <div class="ink"><strong>Warm regards,</strong></div>
    {% if offer.signature_url != "" %}<img src="{{ offer.signature_url }}" alt="Signature" style="display: block; max-height: 56px; max-width: 220px; margin: 8px 0 2px">{% endif %}
    {% if offer.signatory_name != "" %}<div class="ink"><strong>{{ offer.signatory_name }}</strong></div>{% endif %}
    {% if offer.signatory_designation != "" %}<div class="muted">{{ offer.signatory_designation }}</div>{% endif %}
    <div>For {{ company.name }}</div>
  </div>

  <div class="columns" style="margin-top: 32px">
    <div>
      <div class="label" style="margin-bottom: 26px">Candidate signature</div>
      <div style="border-bottom: 1.5px solid #0f172a"></div>
      <div class="muted" style="margin-top: 6px">{{ candidate.name }}</div>
    </div>
    <div>
      <div class="label" style="margin-bottom: 26px">Date</div>
      <div style="border-bottom: 1.5px solid #0f172a"></div>
    </div>
  </div>
</body>
</html>
$starter$
  ) AS "html"
FROM "OfferLetterTemplate" t;

INSERT INTO "DocumentTemplate"
  ("id", "orgId", "documentType", "key", "name", "description", "status", "draftHtml",
   "hasUnpublishedChanges", "liveVersion", "isDefault", "defaultBody", "updatedAt")
SELECT "tid", "orgId", 'OFFER_LETTER', "key", "name", 'Moved from Business Settings', 'PUBLISHED', "html",
       false, 1, false, "content", CURRENT_TIMESTAMP
FROM "_offer_wording";

INSERT INTO "DocumentTemplateVersion" ("id", "templateId", "version", "html", "notes")
SELECT "vid", "tid", 1, "html", 'Moved from Business Settings' FROM "_offer_wording";

INSERT INTO "DocumentTemplateEvent" ("id", "templateId", "action", "version", "notes")
SELECT 'olte_' || substr(md5("tid"), 1, 20), "tid", 'created', 1, 'Moved from Business Settings' FROM "_offer_wording";

-- Orgs without a default offer-letter template default to their base full-time wording,
-- which is what most new offers were pre-filled with before.
UPDATE "DocumentTemplate" d SET "isDefault" = true
FROM "_offer_wording" w
WHERE d."id" = w."tid" AND w."employmentType" = 'FULL_TIME' AND w."jobRole" = ''
  AND NOT EXISTS (
    SELECT 1 FROM "DocumentTemplate" o
    WHERE o."orgId" = w."orgId" AND o."documentType" = 'OFFER_LETTER' AND o."isDefault"
  );

DROP TABLE "_offer_wording";

-- DropTable
DROP TABLE "OfferLetterTemplate";
