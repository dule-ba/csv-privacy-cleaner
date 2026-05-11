const DELIMITERS = [",", ";", "\t", "|"];
const PII_PATTERNS = [
  /(^|_)e?mail(_|$)/i,
  /(^|_)(phone|mobile|tel|telephone|cell)(_|$)/i,
  /(^|_)(ssn|sin|tax_id|national_id)(_|$)/i,
  /(^|_)(address|street|postcode|zip|postal)(_|$)/i,
  /(^|_)(ip|ipv4|ipv6)(_address)?(_|$)/i,
  /(^|_)(full_)?name(_|$)/i
];

export function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 20);
  if (sample.length === 0) return ",";

  let best = { delimiter: ",", score: -Infinity };
  for (const delimiter of DELIMITERS) {
    const counts = sample.map((line) => parseLine(line, delimiter).length);
    const useful = counts.filter((count) => count > 1);
    if (useful.length === 0) continue;

    const average = useful.reduce((sum, count) => sum + count, 0) / useful.length;
    const variance = useful.reduce((sum, count) => sum + Math.abs(count - average), 0);
    const score = useful.length * 10 + average - variance;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const records = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 2;
        continue;
      }
      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      row.push(field);
      records.push(row);
      field = "";
      row = [];
      if (char === "\r" && next === "\n") index += 2;
      else index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const nonEmpty = records.filter((record) => record.some((value) => value.trim() !== ""));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], delimiter, warnings: ["No CSV rows found."] };
  }

  const headers = normalizeHeaders(nonEmpty[0]);
  const warnings = [];
  const rows = nonEmpty.slice(1).map((record, rowIndex) => {
    if (record.length !== headers.length) {
      warnings.push(`Row ${rowIndex + 2} has ${record.length} fields; expected ${headers.length}.`);
    }
    return headers.reduce((entry, header, columnIndex) => {
      entry[header] = record[columnIndex] ?? "";
      return entry;
    }, {});
  });

  return { headers, rows, delimiter, warnings };
}

export function normalizeHeaders(headers) {
  const used = new Map();
  return headers.map((header, index) => {
    const base = normalizeHeader(header) || `column_${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function normalizeHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function inferPiiHeaders(headers) {
  return headers.filter((header) => PII_PATTERNS.some((pattern) => pattern.test(header)));
}

export function cleanRows(rows, headers, options = {}) {
  let nextRows = rows.map((row) => ({ ...row }));
  const removed = { duplicates: 0 };

  if (options.trimWhitespace !== false) {
    nextRows = nextRows.map((row) =>
      Object.fromEntries(headers.map((header) => [header, String(row[header] ?? "").trim()]))
    );
  }

  if (options.removeBlankRows !== false) {
    const before = nextRows.length;
    nextRows = nextRows.filter((row) => headers.some((header) => String(row[header] ?? "").trim() !== ""));
    removed.blankRows = before - nextRows.length;
  }

  if (options.dedupe !== false) {
    const seen = new Set();
    const deduped = [];
    for (const row of nextRows) {
      const key = JSON.stringify(headers.map((header) => row[header] ?? ""));
      if (seen.has(key)) {
        removed.duplicates += 1;
        continue;
      }
      seen.add(key);
      deduped.push(row);
    }
    nextRows = deduped;
  }

  if (options.maskHeaders?.length) {
    nextRows = maskColumns(nextRows, options.maskHeaders);
  }

  return { rows: nextRows, removed };
}

export function maskColumns(rows, headersToMask) {
  const selected = new Set(headersToMask);
  return rows.map((row) => {
    const next = { ...row };
    for (const header of selected) {
      next[header] = maskValue(header, next[header]);
    }
    return next;
  });
}

export function maskValue(header, value) {
  const input = String(value ?? "");
  if (!input) return "";

  if (/mail/i.test(header) && input.includes("@")) {
    const [local, domain] = input.split("@");
    return `${local.slice(0, 1)}***@${domain.replace(/^[^.]*/, "***")}`;
  }

  const digits = input.replace(/\D/g, "");
  if (/(phone|mobile|tel|ssn|sin|tax_id|national_id)/i.test(header) && digits.length >= 4) {
    return `${"*".repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
  }

  if (/(ip|ipv4|ipv6)/i.test(header)) {
    return input.includes(":") ? input.replace(/:[^:]+$/, ":***") : input.replace(/\.\d+$/, ".***");
  }

  if (input.length <= 2) return "*".repeat(input.length);
  return `${input.slice(0, 1)}${"*".repeat(Math.min(8, input.length - 2))}${input.slice(-1)}`;
}

export function profileColumns(headers, rows) {
  return headers.map((header) => {
    const values = rows.map((row) => String(row[header] ?? ""));
    const nonEmpty = values.filter(Boolean);
    const unique = new Set(nonEmpty);
    return {
      header,
      filled: nonEmpty.length,
      blank: values.length - nonEmpty.length,
      unique: unique.size,
      examples: [...unique].slice(0, 3)
    };
  });
}

export function stringifyCSV(headers, rows, delimiter = ",") {
  const lines = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
  return lines.map((line) => line.map((value) => escapeField(value, delimiter)).join(delimiter)).join("\n");
}

function parseLine(line, delimiter) {
  return parseCSV(`${line}\n`, delimiter).headers;
}

function escapeField(value, delimiter) {
  const text = String(value ?? "");
  const mustQuote = text.includes(delimiter) || /["\r\n]/.test(text);
  const escaped = text.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}
