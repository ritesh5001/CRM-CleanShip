import * as XLSX from 'xlsx';
import { Lead } from '../models/Lead.js';
import { ImportBatch } from '../models/ImportBatch.js';

interface RawRow {
  [key: string]: unknown;
}

/** Cleans a cell: strips Excel's text-prefix apostrophes/quotes (e.g. `"+971…`) and trims. */
function clean(v: unknown): string {
  if (v == null) return '';
  return String(v)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

/** Returns the first non-empty cell whose normalized header matches one of `keys`. */
function pick(row: RawRow, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase().replace(/[\s_#-]+/g, '');
    if (keys.includes(norm)) {
      const val = clean(row[key]);
      if (val) return val;
    }
  }
  return '';
}

/** Tries each header group in order and returns the first non-empty match. */
function pickFirst(row: RawRow, groups: string[][]): string {
  for (const group of groups) {
    const val = pick(row, group);
    if (val) return val;
  }
  return '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

/** Maps a CRM field id → the chosen spreadsheet header (admin-defined during import). */
export type FieldMapping = Partial<Record<string, string>>;

export interface ImportPreview {
  headers: string[];
  totalRows: number;
  sample: Record<string, string>[];
}

/** Reads a CSV/Excel buffer and returns its header row, row count, and a small sample. */
export function previewImport(buffer: Buffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headers = (aoa[0] ?? []).map((h) => String(h).trim()).filter(Boolean);
  const sample = aoa.slice(1, 4).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = String((r as unknown[])[i] ?? '').trim();
    });
    return obj;
  });
  return { headers, totalRows: Math.max(0, aoa.length - 1), sample };
}

/**
 * Parses a CSV/Excel buffer and bulk-creates leads. Header matching is
 * case/space/punctuation-insensitive and supports common CRM and Apollo.io
 * export columns, e.g.:
 *   - name        ← name | full name | First Name (+ Last Name)
 *   - phone       ← phone | mobile | Mobile Phone | Work Direct Phone | Corporate Phone | …
 *   - company     ← company | Company Name | organization
 *   - title       ← Title | designation
 *   - city/state/country, email, notes, industry (→ tag).
 */
export async function importLeads(
  buffer: Buffer,
  fileName: string,
  uploadedBy: string,
  assignedTo?: string,
  mapping?: FieldMapping
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  const useMapping = !!mapping && Object.values(mapping).some(Boolean);
  // Reads a field by its admin-mapped header (exact match).
  const mapped = (row: RawRow, field: string) => {
    const header = mapping?.[field];
    return header ? clean(row[header]) : '';
  };

  const errors: { row: number; message: string }[] = [];
  const docs: Record<string, unknown>[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // account for header row

    let name: string;
    let phone: string;
    let altPhone: string;
    let altPhone2: string;
    let email: string;
    let title: string;
    let company: string;
    let city: string;
    let state: string;
    let country: string;
    let source: string;
    let industry: string;
    let notes: string;

    if (useMapping) {
      // Admin chose exactly which column maps to which field.
      name = mapped(row, 'name');
      const lastName = mapped(row, 'lastName');
      if (lastName) name = [name, lastName].filter(Boolean).join(' ').trim();
      phone = mapped(row, 'phone');
      altPhone = mapped(row, 'altPhone');
      altPhone2 = mapped(row, 'altPhone2');
      email = mapped(row, 'email').toLowerCase();
      title = mapped(row, 'title');
      company = mapped(row, 'company');
      city = mapped(row, 'city');
      state = mapped(row, 'state');
      country = mapped(row, 'country');
      source = mapped(row, 'source');
      industry = mapped(row, 'industry');
      notes = mapped(row, 'notes');
    } else {
      // Auto-detect from common CRM/Apollo header names.
      name = pick(row, ['name', 'fullname', 'leadname', 'customername', 'contactname']);
      if (!name) {
        const first = pick(row, ['firstname', 'fname', 'givenname']);
        const last = pick(row, ['lastname', 'lname', 'surname', 'familyname']);
        name = [first, last].filter(Boolean).join(' ').trim();
      }
      const phones = [
        ['phone', 'phonenumber', 'contact', 'contactnumber', 'phone1'],
        ['mobile', 'mobilephone', 'cell', 'cellphone'],
        ['workdirectphone', 'directphone', 'workphone'],
        ['corporatephone', 'companyphone', 'officephone'],
        ['otherphone', 'homephone'],
        ['altphone', 'alternatephone', 'alternativephone', 'phone2', 'secondaryphone', 'secondphone', '2ndphone'],
        ['altphone2', 'alternatephone2', 'phone3', 'thirdphone', '3rdphone'],
      ]
        .map((group) => pick(row, group))
        .filter(Boolean);
      phone = phones[0] ?? '';
      altPhone = phones.find((p) => p !== phone) ?? '';
      altPhone2 = phones.find((p) => p !== phone && p !== altPhone) ?? '';
      email = pick(row, ['email', 'emailaddress']).toLowerCase();
      title = pick(row, ['title', 'jobtitle', 'designation', 'role']);
      company = pickFirst(row, [['company', 'companyname'], ['organization', 'organisation', 'business']]);
      city = pick(row, ['city', 'location', 'area']);
      state = pick(row, ['state', 'province', 'region']);
      country = pick(row, ['country']);
      source = pick(row, ['source', 'leadsource']);
      industry = pick(row, ['industry']);
      notes = pick(row, ['notes', 'remark', 'remarks', 'comment']);
    }

    if (!name && !phone) return; // skip fully empty rows silently
    if (!phone) {
      errors.push({ row: rowNum, message: `Missing phone${name ? ` for "${name}"` : ''}` });
      return;
    }

    docs.push({
      name: name || 'Unknown',
      phone,
      altPhone,
      altPhone2,
      email: EMAIL_RE.test(email) ? email : '',
      title,
      company,
      city,
      state,
      country,
      tags: industry ? [industry] : [],
      source: source || 'import',
      notes,
      status: assignedTo ? 'assigned' : 'new',
      assignedTo: assignedTo || undefined,
      assignedAt: assignedTo ? new Date() : undefined,
      createdBy: uploadedBy,
    });
  });

  let inserted: { _id: unknown }[] = [];
  if (docs.length) {
    inserted = (await Lead.insertMany(docs, { ordered: false }).catch((err: unknown) => {
      // With ordered:false, partial inserts succeed; capture write errors.
      const e = err as { insertedDocs?: unknown[]; writeErrors?: { index: number; errmsg: string }[] };
      (e.writeErrors ?? []).forEach((we) => errors.push({ row: we.index + 2, message: we.errmsg }));
      return e.insertedDocs ?? [];
    })) as { _id: unknown }[];
  }

  const successCount = inserted.length;
  const batch = await ImportBatch.create({
    fileName,
    uploadedBy,
    totalRows: rows.length,
    successCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  });

  if (successCount) {
    await Lead.updateMany(
      { _id: { $in: inserted.map((d) => d._id) } },
      { $set: { importBatch: batch._id } }
    );
  }

  return {
    batchId: String(batch._id),
    totalRows: rows.length,
    successCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  };
}
