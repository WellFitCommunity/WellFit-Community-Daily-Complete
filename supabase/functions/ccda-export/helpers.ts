/**
 * C-CDA Export — formatting and code-mapping helpers.
 * Pure functions, no I/O. Mirrored by deno tests in __tests__/.
 */

export function escapeXml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatHL7DateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  } catch {
    return '';
  }
}

export function formatHL7Date(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  } catch {
    return '';
  }
}

export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US');
  } catch {
    return dateStr || '';
  }
}

export function mapGenderCode(gender: string | null | undefined): string {
  if (!gender) return 'UN';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'M';
  if (g === 'female' || g === 'f') return 'F';
  return 'UN';
}

export function mapAllergyTypeCode(type: string | null | undefined): string {
  if (!type) return '419199007';
  const t = type.toLowerCase();
  if (t === 'medication' || t === 'drug') return '416098002';
  if (t === 'food') return '414285001';
  if (t === 'environment' || t === 'environmental') return '426232007';
  return '419199007'; // Allergy to substance (general)
}
