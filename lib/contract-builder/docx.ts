import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import type { Bi, ContractDocument } from "./document";

/**
 * The editable Word version of a built agreement. Bilingual agreements are laid out as a two-column table per
 * clause (English left, local language right), the layout Thai, Indonesian and Vietnamese bilingual contracts use.
 */

const INK = "06162B";
const MUTED = "5F6B7A";
const LINE = "C9D1DA";
const MIST = "F3F6F8";
const TEAL = "0B8F8C";
const SCRIPT_FONT: Record<string, string> = { th: "Leelawadee UI", lo: "Leelawadee UI", km: "Khmer UI" };
const CREDIT = "Free template from RoveHQ · rovehq.io";

type Logo = { data: Buffer; type: "png" | "jpg"; width: number; height: number } | null;

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

export async function renderContractDocx(doc: ContractDocument, logo: Logo): Promise<Buffer> {
  const two = doc.bilingual;
  const script = SCRIPT_FONT[doc.locale];
  const font = { ascii: "Arial", hAnsi: "Arial", cs: script || "Arial", eastAsia: script || "Arial" };
  const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font, bold: opts.bold, size: opts.size ?? 21, color: opts.color ?? INK });
  const para = (text: string, opts: { bold?: boolean; size?: number; color?: string; after?: number; before?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
      alignment: opts.align,
      children: String(text || "")
        .split("\n")
        .flatMap((line, i) => (i ? [new TextRun({ break: 1 }), run(line, opts)] : [run(line, opts)]))
    });
  const cell = (children: Paragraph[], opts: { width: number; shade?: boolean; borders?: boolean; height?: number } = { width: 50 }) =>
    new TableCell({
      width: { size: opts.width, type: WidthType.PERCENTAGE },
      borders: opts.borders ? allBorders : { top: none, bottom: none, left: none, right: none },
      shading: opts.shade ? { type: ShadingType.CLEAR, color: "auto", fill: MIST } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children
    });
  const pairTable = (text: Bi, opts: { bold?: boolean; size?: number; before?: number } = {}) =>
    two
      ? new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: noBorders,
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                cell([para(text.en, { ...opts, after: 60, before: opts.before })], { width: 50 }),
                cell([para(text.local, { ...opts, color: opts.bold ? INK : "26384F", after: 60, before: opts.before })], { width: 50 })
              ]
            })
          ]
        })
      : para(text.en, { ...opts, after: 100 });
  // 10.5pt minimum for contract text: Thailand's rental contract rules ask for letters at least 2 mm high.
  const label = (text: Bi) => [para(text.en, { bold: true, size: 21, after: two && text.local ? 0 : 40 }), ...(two && text.local ? [para(text.local, { size: 21, color: MUTED, after: 40 })] : [])];

  const children: Array<Paragraph | Table> = [];
  // Title block
  children.push(para(doc.title.en, { bold: true, size: 34, after: 0 }));
  if (two && doc.title.local) children.push(para(doc.title.local, { bold: true, size: 26, color: TEAL, after: 0 }));
  children.push(para([doc.subtitle.en, two ? doc.subtitle.local : ""].filter(Boolean).join(" · "), { size: 18, color: MUTED, after: 200 }));

  for (const block of doc.blocks) {
    if (block.kind === "heading") {
      if (block.pageBreak) children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(pairTable(block.text, { bold: true, size: 22, before: 160 }));
    } else if (block.kind === "clause") {
      children.push(pairTable(block.text));
    } else if (block.kind === "fields") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: block.rows.map(
            (row) => new TableRow({ cantSplit: true, height: { value: 420, rule: HeightRule.ATLEAST }, children: [cell(label(row.label), { width: 42, shade: true, borders: true }), cell([para(row.value, { after: 0 })], { width: 58, borders: true })] })
          )
        }),
        para("", { after: 80 })
      );
    } else if (block.kind === "sign") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: block.rows.map((row) => new TableRow({ cantSplit: true, height: { value: 1100, rule: HeightRule.ATLEAST }, children: [cell(label(row), { width: 42, shade: true, borders: true }), cell([para("")], { width: 58, borders: true })] }))
        }),
        para("", { after: 80 })
      );
    } else if (block.kind === "grid") {
      const widths = block.columns.length === 3 ? [40, 30, 30] : [60, 40];
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ tableHeader: true, children: block.columns.map((col, i) => cell(label(col), { width: widths[i] || 30, shade: true, borders: true })) }),
            ...block.rows.map((row) => new TableRow({ cantSplit: true, height: { value: 480, rule: HeightRule.ATLEAST }, children: block.columns.map((_, i) => cell(i === 0 ? label(row) : [para("")], { width: widths[i] || 30, borders: true })) }))
          ]
        }),
        para("", { after: 80 })
      );
    }
  }

  const b = doc.business;
  const headerRight = [b.name, b.address, b.phone, b.email, b.reg].filter(Boolean).join("\n");
  const header = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: INK } },
        rows: [
          new TableRow({
            children: [
              cell(
                [
                  logo
                    ? new Paragraph({ children: [new ImageRun({ type: logo.type, data: logo.data, transformation: fit(logo.width, logo.height, 170, 56) })] })
                    : para("")
                ],
                { width: 45 }
              ),
              cell([para(headerRight, { size: 16, color: MUTED, align: AlignmentType.RIGHT, after: 60 })], { width: 55 })
            ]
          })
        ]
      })
    ]
  });
  const footerText = doc.footer.en;
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${footerText}   ·   ${doc.pageWords.page} `, font, size: 15, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font, size: 15, color: MUTED }),
          new TextRun({ text: ` ${doc.pageWords.of} `, font, size: 15, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 15, color: MUTED })
        ]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: CREDIT, font, size: 14, color: "8A97A6" })] })
    ]
  });

  const file = new Document({
    creator: "RoveHQ",
    title: `${doc.title.en}${b.name ? ` · ${b.name}` : ""}`,
    styles: { default: { document: { run: { font: "Arial", size: 19 } } } },
    sections: [{ properties: { page: { margin: { top: 1300, bottom: 1000, left: 900, right: 900, header: 400, footer: 400 } } }, headers: { default: header }, footers: { default: footer }, children }]
  });
  return Buffer.from(await Packer.toBuffer(file));
}

function fit(width: number, height: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / (width || maxW), maxH / (height || maxH), 1);
  return { width: Math.round((width || maxW) * ratio), height: Math.round((height || maxH) * ratio) };
}
