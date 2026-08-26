// Simulate sanitize for iPhone 14 and 15 Pro Max scenarios

function compareOldestFirst(dateA, createdA, dateB, createdB) {
  const docDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
  if (docDiff !== 0) return docDiff;
  return new Date(createdA).getTime() - new Date(createdB).getTime();
}

function sanitizeMovements(rows, options) {
  const sorted = [...rows].sort((a, b) =>
    compareOldestFirst(a.date, a.createdAt, b.date, b.createdAt)
  );
  let balance = 0;
  const result = [];
  for (const row of sorted) {
    if (row.type === "stocktake") {
      if (row.quantity === 0) {
        result.push(row);
        continue;
      }
      if (row.direction === "out" && balance <= 0) continue;
      if (
        options.isPhone &&
        row.direction === "out" &&
        row.stocktakeCountedQuantity === 0 &&
        options.availableSerials > 0
      ) {
        continue;
      }
      if (row.direction === "out" && row.quantity > balance) continue;
    }
    const signedQuantity = row.direction === "in" ? row.quantity : -row.quantity;
    if (signedQuantity < 0 && balance + signedQuantity < 0) continue;
    result.push(row);
    if (row.type === "stocktake" && row.stocktakeCountedQuantity != null) {
      balance = Math.max(0, row.stocktakeCountedQuantity);
    } else {
      balance = Math.max(0, balance + signedQuantity);
    }
  }
  return { result, balance };
}

// iPhone 15 Pro Max
const ip15 = sanitizeMovements(
  [
    { type: "sale", direction: "out", quantity: 1, date: "2026-08-05", createdAt: "2026-08-05" },
    {
      type: "stocktake",
      direction: "out",
      quantity: 2,
      stocktakeCountedQuantity: 0,
      date: "2026-08-08",
      createdAt: "2026-08-08",
    },
  ],
  { isPhone: true, availableSerials: 0 }
);
console.log("iPhone 15 Pro Max:", ip15.result.length, "rows, balance", ip15.balance);

// iPhone 14
const ip14 = sanitizeMovements(
  [
    { type: "stock_entry", direction: "in", quantity: 1, date: "2026-08-07", createdAt: "2026-08-07" },
    {
      type: "stocktake",
      direction: "out",
      quantity: 1,
      stocktakeCountedQuantity: 0,
      date: "2026-08-08",
      createdAt: "2026-08-08",
    },
  ],
  { isPhone: true, availableSerials: 1 }
);
console.log("iPhone 14:", ip14.result.length, "rows, balance", ip14.balance);
