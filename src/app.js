import {
  cleanRows,
  detectDelimiter,
  inferPiiHeaders,
  parseCSV,
  profileColumns,
  stringifyCSV
} from "./csv-tools.js";

const sample = `Full Name,Email,Phone,Plan,Monthly Spend
Ana Markovic,ana@example.com,+38164111222,Starter,19
Ana Markovic,ana@example.com,+38164111222,Starter,19
Milan Petrovic,milan@example.com,+38164222333,Pro,49
Sara Ilic,sara@example.com,+38164333444,Pro,49`;

const state = {
  sourceText: sample,
  parsed: null,
  cleaned: null,
  maskHeaders: []
};

const els = {
  file: document.querySelector("#file"),
  input: document.querySelector("#input"),
  delimiter: document.querySelector("#delimiter"),
  normalize: document.querySelector("#normalize"),
  dedupe: document.querySelector("#dedupe"),
  mask: document.querySelector("#mask"),
  run: document.querySelector("#run"),
  download: document.querySelector("#download"),
  status: document.querySelector("#status"),
  warnings: document.querySelector("#warnings"),
  stats: document.querySelector("#stats"),
  maskFields: document.querySelector("#mask-fields"),
  table: document.querySelector("#preview-table")
};

els.input.value = sample;
process();

els.file.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.sourceText = await file.text();
  els.input.value = state.sourceText;
  process();
});

els.input.addEventListener("input", () => {
  state.sourceText = els.input.value;
});

els.run.addEventListener("click", process);
els.delimiter.addEventListener("change", process);
els.normalize.addEventListener("change", process);
els.dedupe.addEventListener("change", process);
els.mask.addEventListener("change", process);

els.download.addEventListener("click", () => {
  if (!state.cleaned) return;
  const csv = stringifyCSV(state.cleaned.headers, state.cleaned.rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cleaned.csv";
  link.click();
  URL.revokeObjectURL(url);
});

function process() {
  const text = els.input.value;
  const delimiter = els.delimiter.value === "auto" ? detectDelimiter(text) : els.delimiter.value;
  const parsed = parseCSV(text, delimiter);
  const piiHeaders = inferPiiHeaders(parsed.headers);
  state.maskHeaders = els.mask.checked ? piiHeaders : [];

  const cleaned = cleanRows(parsed.rows, parsed.headers, {
    dedupe: els.dedupe.checked,
    trimWhitespace: true,
    removeBlankRows: true,
    maskHeaders: state.maskHeaders
  });

  state.parsed = parsed;
  state.cleaned = { headers: parsed.headers, rows: cleaned.rows, removed: cleaned.removed };

  render(parsed, state.cleaned);
}

function render(parsed, cleaned) {
  const delimiterName = parsed.delimiter === "\t" ? "tab" : parsed.delimiter;
  els.status.textContent = `${cleaned.rows.length} rows ready, ${parsed.headers.length} columns, delimiter "${delimiterName}"`;
  els.download.disabled = cleaned.rows.length === 0;

  els.warnings.innerHTML = "";
  for (const warning of parsed.warnings.slice(0, 4)) {
    const item = document.createElement("li");
    item.textContent = warning;
    els.warnings.append(item);
  }

  const stats = [
    ["Original rows", parsed.rows.length],
    ["Duplicates removed", cleaned.removed.duplicates],
    ["Blank rows removed", cleaned.removed.blankRows ?? 0],
    ["Masked columns", state.maskHeaders.length]
  ];
  els.stats.innerHTML = stats
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  els.maskFields.innerHTML = state.maskHeaders.length
    ? state.maskHeaders.map((header) => `<span>${header}</span>`).join("")
    : "<span>No PII columns detected</span>";

  const profiles = profileColumns(cleaned.headers, cleaned.rows);
  const previewRows = cleaned.rows.slice(0, 50);
  els.table.innerHTML = `
    <thead>
      <tr>${cleaned.headers.map((header) => `<th>${header}</th>`).join("")}</tr>
      <tr>${profiles
        .map((profile) => `<td>${profile.unique} unique / ${profile.blank} blank</td>`)
        .join("")}</tr>
    </thead>
    <tbody>
      ${previewRows
        .map(
          (row) =>
            `<tr>${cleaned.headers
              .map((header) => `<td>${escapeHTML(row[header] ?? "")}</td>`)
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  `;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
