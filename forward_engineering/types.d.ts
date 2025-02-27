export type ColumnDefinition = {
  name: string;
  type: string;
  isActivated: boolean;
  length?: number;
  precision?: number;
  primaryKey?: boolean;
  scale?: number;
  dataTypeMode?: string;
};

export type ConstraintDtoColumn = {
  name: string;
  isActivated: boolean;
};

export type KeyType = 'PRIMARY KEY' | 'NOT NULL';

export type ConstraintDto = {
  keyType: KeyType;
  columns?: ConstraintDtoColumn[];
};

export type JsonSchema = Record<string, unknown>;
