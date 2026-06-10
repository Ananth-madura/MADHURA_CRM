// utils/invoicecal.js

export const calculateTotals = (items = [], gstMode = "Exclusive") => {
  let subtotal = 0;
  let total_discount = 0;
  let total_cgst = 0;
  let total_sgst = 0;
  let total_igst = 0;

  items.forEach(item => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    const discount = Number(item.discount) || 0;
    const gstPercent = Number(item.tax) || 0;

    const base = price * qty;
    const afterDiscount = base - discount;

    if (gstMode === "Exempt") {
      subtotal += base;
      total_discount += discount;
      return;
    }

    if (gstMode === "Inclusive") {
      const taxableValue = afterDiscount / (1 + gstPercent / 100);
      const gstAmount = afterDiscount - taxableValue;
      subtotal += base;
      total_discount += discount;
      total_cgst += gstAmount / 2;
      total_sgst += gstAmount / 2;
    } else {
      const gstAmount = (afterDiscount * gstPercent) / 100;
      subtotal += base;
      total_discount += discount;
      total_cgst += gstAmount / 2;
      total_sgst += gstAmount / 2;
    }
  });

  const gstAmount = total_cgst + total_sgst;

  const grand_total =
    gstMode === "Exempt" || gstMode === "Inclusive"
      ? subtotal - total_discount
      : subtotal - total_discount + gstAmount;

  return {
    subtotal: +subtotal.toFixed(2),
    total_discount: +total_discount.toFixed(2),
    total_cgst: +total_cgst.toFixed(2),
    total_sgst: +total_sgst.toFixed(2),
    total_igst: +total_igst.toFixed(2),
    grand_total: +grand_total.toFixed(2),
  };
};

export const calculateItemTotal = (item, gstMode = "Exclusive") => {
  const price = Number(item.price) || 0;
  const qty = Number(item.qty) || 0;
  const discount = Number(item.discount) || 0;
  const gstPercent = Number(item.tax) || 0;

  const base = price * qty;
  const afterDiscount = base - discount;

  if (gstMode === "Exempt") return +afterDiscount.toFixed(2);

  if (gstMode === "Inclusive") {
    const taxableValue = afterDiscount / (1 + gstPercent / 100);
    const gstAmount = afterDiscount - taxableValue;
    return +(afterDiscount).toFixed(2);
  }

  const gstAmount = (afterDiscount * gstPercent) / 100;
  return +(afterDiscount + gstAmount).toFixed(2);
};
