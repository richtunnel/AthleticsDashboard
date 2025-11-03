export interface GameExpense {
  id: string;
  gameId: string;
  travelExpense: number;
  foodExpense: number;
  clothesExpense: number;
  giftsExpense: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  game?: {
    id: string;
    date: string;
    homeTeam: {
      name: string;
      level: string;
      sport: {
        name: string;
      };
    };
    opponent?: {
      name: string;
    };
    venue?: {
      name: string;
    };
  };
}

export interface ExpenseAnalytics {
  monthlyData: MonthlyExpenseData[];
  totals: ExpenseTotals;
  averagePerGame: number;
}

export interface MonthlyExpenseData {
  month: string;
  year: number;
  travelExpense: number;
  foodExpense: number;
  clothesExpense: number;
  giftsExpense: number;
  totalExpense: number;
  gameCount: number;
}

export interface ExpenseTotals {
  travelExpense: number;
  foodExpense: number;
  clothesExpense: number;
  giftsExpense: number;
  totalExpense: number;
  gameCount: number;
}

export interface ExpenseFormData {
  gameId: string;
  travelExpense: number;
  foodExpense: number;
  clothesExpense: number;
  giftsExpense: number;
  notes?: string;
}
