export function generateFinnishReferenceNumber(base: string | number) {
  const digits = String(base).replace(/\D/g, '');
  if (!digits) throw new Error('Reference base must contain digits');
  const weights = [7, 3, 1];
  let sum = 0;
  let weightIndex = 0;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += Number(digits[i]) * weights[weightIndex];
    weightIndex = (weightIndex + 1) % weights.length;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${digits}${checkDigit}`;
}
