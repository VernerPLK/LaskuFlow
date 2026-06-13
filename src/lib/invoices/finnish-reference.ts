const weights = [7, 3, 1];

export function calculateFinnishReferenceCheckDigit(base: string) {
  const digits = base.replace(/\D/g, '');
  if (!digits) throw new Error('Reference base must contain digits');

  const sum = digits
    .split('')
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * weights[index % weights.length], 0);

  const nextTen = Math.ceil(sum / 10) * 10;
  return String((nextTen - sum) % 10);
}

export function generateFinnishReferenceNumber(invoiceNumber: string | number, organizationPrefix = '') {
  const base = `${organizationPrefix}${invoiceNumber}`.replace(/\D/g, '');
  if (base.length < 3) return generateFinnishReferenceNumber(String(invoiceNumber).padStart(3, '0'), organizationPrefix);
  return `${base}${calculateFinnishReferenceCheckDigit(base)}`;
}

export function formatFinnishReferenceNumber(reference: string) {
  return reference.replace(/\s/g, '').replace(/(.{5})/g, '$1 ').trim();
}
