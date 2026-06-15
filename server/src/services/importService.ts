import * as XLSX from 'xlsx';
import { Lead } from '../models/Lead.js';
import { ImportBatch } from '../models/ImportBatch.js';

interface RawRow {
  [key: string]: unknown;
}

/** Normalizes a header to a canonical lead field name. */
function pick(row: RawRow, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (keys.includes(norm)) {
      const v = row[key];
      return v == null ? '' : String(v).trim();
    }
  }
  return '';
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

/**
 * Parses a CSV/Excel buffer and bulk-creates leads.
 * Recognized columns (case/space-insensitive): name, phone, altphone, email, company, city, source, notes.
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
    const name = pick(row, ['name', 'fullname', 'leadname', 'customername']);
    const phone = pick(row, ['phone', 'mobile', 'phonenumber', 'contact', 'contactnumber']);

    if (!name && !phone) return; // skip fully empty rows silently
    if (!phone) {
      errors.push({ row: rowNum, message: 'Missing phone' });
      return;
    }

    docs.push({
      name: name || 'Unknown',
      phone,
      altPhone: pick(row, ['altphone', 'alternatephone', 'phone2']),
      email: pick(row, ['email', 'emailaddress']).toLowerCase(),
      company: pick(row, ['company', 'organization', 'business']),
      city: pick(row, ['city', 'location', 'area']),
      source: pick(row, ['source']) || 'import',
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
