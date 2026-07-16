import { User, Expense, Settlement, SimplifiedDebt, MemberBalance } from './types';

/**
 * Calculates net balances across all group members after processing
 * all recorded expenses and settlements.
 */
export function calculateMemberBalances(
  members: User[],
  expenses: Expense[],
  settlements: Settlement[]
): MemberBalance[] {
  // Initialize balances map to zero for every member
  const balanceMap = new Map<string, number>();
  for (const member of members) {
    balanceMap.set(member.id, 0);
  }

  // Process Expenses
  for (const expense of expenses) {
    // Payer is credited the total amount paid
    const currentPayerBal = balanceMap.get(expense.paidByUserId) || 0;
    balanceMap.set(expense.paidByUserId, currentPayerBal + Number(expense.amount));

    // Each participant split is debited their share
    for (const split of expense.splits) {
      const currentDebtorBal = balanceMap.get(split.userId) || 0;
      balanceMap.set(split.userId, currentDebtorBal - Number(split.amountOwed));
    }
  }

  // Process Settlements already paid
  for (const settlement of settlements) {
    // Payer of settlement gets positive offset
    const fromBal = balanceMap.get(settlement.fromUserId) || 0;
    balanceMap.set(settlement.fromUserId, fromBal + Number(settlement.amount));

    // Recipient of settlement reduces what they are owed
    const toBal = balanceMap.get(settlement.toUserId) || 0;
    balanceMap.set(settlement.toUserId, toBal - Number(settlement.amount));
  }

  return members.map(user => ({
    user,
    netAmount: Math.round((balanceMap.get(user.id) || 0) * 100) / 100
  }));
}

/**
 * Min-Cash-Flow Algorithm to simplify group debts to minimal transfer count.
 */
export function simplifyDebts(
  members: User[],
  expenses: Expense[],
  settlements: Settlement[]
): SimplifiedDebt[] {
  const memberBalances = calculateMemberBalances(members, expenses, settlements);

  // Separate debtors (<0) and creditors (>0)
  const debtors = memberBalances
    .filter(b => b.netAmount < -0.01)
    .map(b => ({ user: b.user, amountOwed: Math.abs(b.netAmount) }));
  
  const creditors = memberBalances
    .filter(b => b.netAmount > 0.01)
    .map(b => ({ user: b.user, amountToReceive: b.netAmount }));

  const results: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amountToSettle = Math.min(debtor.amountOwed, creditor.amountToReceive);

    if (amountToSettle > 0.01) {
      results.push({
        fromUser: debtor.user,
        toUser: creditor.user,
        amount: Math.round(amountToSettle * 100) / 100
      });
    }

    debtor.amountOwed -= amountToSettle;
    creditor.amountToReceive -= amountToSettle;

    if (debtor.amountOwed <= 0.01) {
      i++;
    }
    if (creditor.amountToReceive <= 0.01) {
      j++;
    }
  }

  return results;
}
