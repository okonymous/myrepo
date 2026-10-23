import type { FeedItem } from "./monitoring/types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const COLUMNS: Array<[string, (item: FeedItem) => string | number]> = [
  ["Title", (i) => i.title],
  ["Type", (i) => i.kind],
  ["Source", (i) => i.source],
  ["Author", (i) => i.author ?? ""],
  ["Sentiment", (i) => i.sentiment],
  ["Score", (i) => i.sentimentScore],
  ["Likes", (i) => i.likes],
  ["Comments", (i) => i.comments],
  ["Shares", (i) => i.shares],
  ["Engagement", (i) => i.engagement],
  ["Published", (i) => i.publishedAt],
  ["URL", (i) => i.url],
];

function toRows(items: FeedItem[]) {
  return items.map((item) => Object.fromEntries(COLUMNS.map(([key, get]) => [key, get(item)])));
}

export function exportCsv(items: FeedItem[], filename = "pulse-export.csv") {
  const header = COLUMNS.map(([key]) => key).join(",");
  const body = items
    .map((item) =>
      COLUMNS.map(([, get]) => `"${String(get(item)).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`).join(","),
    )
    .join("\n");
  download(new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" }), filename);
}

export async function exportExcel(items: FeedItem[], filename = "pulse-export.xlsx") {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(toRows(items));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Mentions");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export async function exportPdf(items: FeedItem[], title = "Monitoring report", filename = "pulse-export.pdf") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} · ${items.length} records`, 14, 22);
  autoTable(doc, {
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 90] },
    head: [["Title", "Type", "Source", "Author", "Sentiment", "Engagement", "Published"]],
    body: items
      .slice(0, 500)
      .map((i) => [
        i.title.slice(0, 90),
        i.kind,
        i.source,
        (i.author ?? "").slice(0, 28),
        i.sentiment,
        String(i.engagement),
        new Date(i.publishedAt).toLocaleString(),
      ]),
  });
  doc.save(filename);
}