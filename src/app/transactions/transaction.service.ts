import { Injectable } from '@angular/core';

export type TransactionType = 'in' | 'out' | 'move';

export interface TransactionItem {
  type: TransactionType;
  name: string;
  productId?: string;
  sku?: string;
  time: string;
  operator: string;
  route: string;
  amount: string;
  note?: string;
  createdAt: string;
}

const STORAGE_KEY = 'gudangfp_transactions';

const DEFAULT_TRANSACTIONS: TransactionItem[] = [
];

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  getTransactions(): TransactionItem[] {
    const savedTransactions = localStorage.getItem(STORAGE_KEY);

    if (!savedTransactions) {
      this.saveTransactions(DEFAULT_TRANSACTIONS);
      return [...DEFAULT_TRANSACTIONS];
    }

    try {
      return JSON.parse(savedTransactions) as TransactionItem[];
    } catch {
      this.saveTransactions(DEFAULT_TRANSACTIONS);
      return [...DEFAULT_TRANSACTIONS];
    }
  }

  addTransaction(transaction: TransactionItem) {
    const transactions = this.getTransactions();
    transactions.unshift(transaction);
    this.saveTransactions(transactions);
  }

  getTransactionsByProduct(productId: string, sku?: string, name?: string) {
    return this.getTransactions().filter(transaction =>
      transaction.productId === productId ||
      (!!sku && transaction.sku === sku) ||
      (!!name && transaction.name === name)
    );
  }

  getTotalByType(type: TransactionType) {
    return this.getTransactions()
      .filter(transaction => transaction.type === type)
      .reduce((total, transaction) => total + Math.abs(Number(transaction.amount.replace(/[^\d.-]/g, '')) || 0), 0);
  }

  getTodayTransactions(): TransactionItem[] {
    const todayKey = this.toDateKey(new Date());

    return this.getTransactions().filter(transaction => this.toDateKey(new Date(transaction.createdAt)) === todayKey);
  }

  getTodayTotalByType(type: TransactionType) {
    return this.getTodayTransactions()
      .filter(transaction => transaction.type === type)
      .reduce((total, transaction) => total + Math.abs(Number(transaction.amount.replace(/[^\d.-]/g, '')) || 0), 0);
  }

  private toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private saveTransactions(transactions: TransactionItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }
}
