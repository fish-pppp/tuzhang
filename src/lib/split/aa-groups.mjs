function newestExpenseFirst(a, b) {
  return b.expense.createdAt.localeCompare(a.expense.createdAt);
}

export function sortRowsByNewest(rows) {
  return [...rows].sort(newestExpenseFirst);
}

function sortPersonGroups(groups) {
  return groups.sort((a, b) => b.cents - a.cents || a.memberId.localeCompare(b.memberId));
}

/** Who still owes me how much from the bills I already A'd. */
export function groupOthersOweByPerson(paidByMe) {
  const map = new Map();
  for (const row of paidByMe) {
    for (const slice of row.others) {
      let group = map.get(slice.memberId);
      if (!group) {
        group = { memberId: slice.memberId, cents: 0, rows: [] };
        map.set(slice.memberId, group);
      }
      group.cents += slice.cents;
      group.rows.push({ expense: row.expense, cents: slice.cents });
    }
  }
  for (const group of map.values()) {
    group.rows.sort(newestExpenseFirst);
  }
  return sortPersonGroups([...map.values()]);
}

/** Bills someone else A'd that I still need to chip into, grouped by who paid. */
export function groupChipByPayer(chipRows) {
  const map = new Map();
  for (const row of chipRows) {
    const payerId = row.expense.payerId;
    let group = map.get(payerId);
    if (!group) {
      group = { memberId: payerId, cents: 0, rows: [] };
      map.set(payerId, group);
    }
    group.cents += row.myShareCents;
    group.rows.push({ expense: row.expense, cents: row.myShareCents });
  }
  for (const group of map.values()) {
    group.rows.sort(newestExpenseFirst);
  }
  return sortPersonGroups([...map.values()]);
}
