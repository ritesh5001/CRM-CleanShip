import * as XLSX from 'xlsx';
import { Lead } from '../models/Lead.js';
import { ImportBatch } from '../models/ImportBatch.js';

interface RawRow {
  [key: string]: unknown;
}

/** Cleans a cell: strips Excel's leading text-prefix apostrophe and trims. */
function clean(v: unknown): string {
  if (v == null) return '';
  return String(v).trim().replace(/^'+/, '').trim();
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
  assignedTo?: string
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  const errors: { row: number; message: string }[] = [];
  const docs: Record<string, unknown>[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // account for header row

    // Name: a single name column, otherwise First + Last name.
    let name = pick(row, ['name', 'fullname', 'leadname', 'customername', 'contactname']);
    if (!name) {
      const first = pick(row, ['firstname', 'fname', 'givenname']);
      const last = pick(row, ['lastname', 'lname', 'surname', 'familyname']);
      name = [first, last].filter(Boolean).join(' ').trim();
    }

    // Collect all phone columns in priority order (mobile/direct first), then
    // use the first as the primary and the first distinct one as altPhone.
    const phones = [
      ['phone', 'phonenumber', 'contact', 'contactnumber'],
      ['mobile', 'mobilephone', 'cell', 'cellphone'],
      ['workdirectphone', 'directphone', 'workphone'],
      ['corporatephone', 'companyphone', 'officephone'],
      ['otherphone', 'homephone'],
    ]
      .map((group) => pick(row, group))
      .filter(Boolean);

    const phone = phones[0] ?? '';
    const altPhone = phones.find((p) => p !== phone) ?? '';

    if (!name && !phone) return; // skip fully empty rows silently
    if (!phone) {
      errors.push({ row: rowNum, message: `Missing phone${name ? ` for "${name}"` : ''}` });
      return;
    }

    const email = pick(row, ['email', 'emailaddress']).toLowerCase();
    const industry = pick(row, ['industry']);

    docs.push({
      name: name || 'Unknown',
      phone,
      altPhone,
      email: EMAIL_RE.test(email) ? email : '',
      title: pick(row, ['title', 'jobtitle', 'designation', 'role']),
      company: pickFirst(row, [['company', 'companyname'], ['organization', 'organisation', 'business']]),
      city: pick(row, ['city', 'location', 'area']),
      state: pick(row, ['state', 'province', 'region']),
      country: pick(row, ['country']),
      tags: industry ? [industry] : [],
      source: pick(row, ['source', 'leadsource']) || 'import',
      notes: pick(row, ['notes', 'remark', 'remarks', 'comment']),
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
