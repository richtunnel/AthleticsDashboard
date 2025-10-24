export type FilterCondition = "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty" | "greater_than" | "less_than" | "between";

export interface ColumnFilterValue {
  type: "values" | "condition";
  values?: string[];
  condition?: FilterCondition;
  value?: string;
  secondValue?: string;
}

export type ColumnFilters = Record<string, ColumnFilterValue>;
