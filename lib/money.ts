export function formatMoney(amountNpr: number, signed = false) {
  const sign = amountNpr < 0 ? "-" : signed && amountNpr > 0 ? "+" : "";
  return `${sign}NPR ${Math.abs(amountNpr).toLocaleString("en-IN")}`;
}
