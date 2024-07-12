import type { DatabaseService } from "@/database/service.js";
import type { Schema } from "@/schema/common.js";
import {
  isEnumColumn,
  isJSONColumn,
  isMaterialColumn,
  isOptionalColumn,
  isReferenceColumn,
  isScalarColumn,
} from "@/schema/utils.js";
import { createSqliteDatabase } from "@/utils/sqlite.js";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { pgTable } from "drizzle-orm/pg-core";
import {
  doublePrecision as PgDoublePrecision,
  integer as PgInteger,
  jsonb as PgJsonb,
  numeric as PgNumeric,
  text as PgText,
} from "drizzle-orm/pg-core";
import {
  integer as SQLiteInteger,
  real as SQLiteReal,
  text as SQLiteText,
  sqliteTable,
} from "drizzle-orm/sqlite-core";
import { SQLiteBigintBuilder } from "./bigint.js";
import { PgHexBuilder, SQLiteHexBuilder } from "./hex.js";
import { SQLiteJsonBuilder } from "./json.js";

export const createDrizzleDb = (database: DatabaseService) => {
  if (database.kind === "postgres") {
    const drizzle = drizzlePg(database.readonlyPool);
    return {
      // @ts-ignore
      select: (...args: any[]) => drizzle.select(...args),
      execute: (query: any) => drizzle.execute(query),
    };
  } else {
    const drizzle = drizzleSQLite(
      createSqliteDatabase(database.userDatabaseFile),
    );
    return {
      // @ts-ignore
      select: (...args: any[]) => drizzle.select(...args),
      execute: (query: any) => drizzle.all(query),
    };
  }
};

type SQLiteTable = Parameters<typeof sqliteTable>[1];
type PostgresTable = Parameters<typeof pgTable>[1];
type DrizzleTable = { [tableName: string]: any };

export const convertSchemaToDrizzle = (
  schema: Schema,
  database: DatabaseService,
) => {
  const drizzleTables: { [tableName: string]: DrizzleTable } = {};

  for (const [tableName, table] of Object.entries(schema)) {
    const drizzleColumns: DrizzleTable = {};

    for (const [columnName, column] of Object.entries(table)) {
      if (isMaterialColumn(column)) {
        if (isJSONColumn(column)) {
          drizzleColumns[columnName] = convertJsonColumn(
            columnName,
            database.kind,
          );
        } else if (isEnumColumn(column)) {
          drizzleColumns[columnName] = convertEnumColumn(
            columnName,
            database.kind,
          );
        } else if (isScalarColumn(column) || isReferenceColumn(column)) {
          switch (column[" scalar"]) {
            case "string":
              drizzleColumns[columnName] = convertStringColumn(
                columnName,
                database.kind,
              );
              break;

            case "int":
              drizzleColumns[columnName] = convertIntColumn(
                columnName,
                database.kind,
              );
              break;

            case "boolean":
              drizzleColumns[columnName] = convertBooleanColumn(
                columnName,
                database.kind,
              );
              break;

            case "float":
              drizzleColumns[columnName] = convertFloatColumn(
                columnName,
                database.kind,
              );
              break;

            case "hex":
              drizzleColumns[columnName] = convertHexColumn(
                columnName,
                database.kind,
              );
              break;

            case "bigint":
              drizzleColumns[columnName] = convertBigintColumn(
                columnName,
                database.kind,
              );
              break;
          }

          // apply column constraints
          if (columnName === "id") {
            drizzleColumns[columnName] =
              drizzleColumns[columnName]!.primaryKey();
          } else if (isOptionalColumn(column) === false) {
            drizzleColumns[columnName] = drizzleColumns[columnName]!.notNull();
          }
        }
      }
    }

    if (database.kind === "postgres") {
      // if (database.schema === "public") {
      return pgTable(tableName, drizzleColumns as PostgresTable);
      // }
      // return pgSchema(database.schema).table(
      //   tableName,
      //   drizzleColumns as PostgresTable,
      // );
    } else {
      drizzleTables[tableName] = sqliteTable(
        tableName,
        drizzleColumns as SQLiteTable,
      );
    }
  }

  return drizzleTables;
};

const convertStringColumn = (
  columnName: string,
  kind: "sqlite" | "postgres",
) => {
  return kind === "sqlite" ? SQLiteText(columnName) : PgText(columnName);
};

const convertIntColumn = (columnName: string, kind: "sqlite" | "postgres") => {
  return kind === "sqlite" ? SQLiteInteger(columnName) : PgInteger(columnName);
};

const convertFloatColumn = (
  columnName: string,
  kind: "sqlite" | "postgres",
) => {
  return kind === "sqlite"
    ? SQLiteReal(columnName)
    : PgDoublePrecision(columnName);
};

const convertBooleanColumn = (
  columnName: string,
  kind: "sqlite" | "postgres",
) => {
  return kind === "sqlite" ? SQLiteInteger(columnName) : PgInteger(columnName);
};

const convertHexColumn = (columnName: string, kind: "sqlite" | "postgres") => {
  return kind === "sqlite"
    ? new SQLiteHexBuilder(columnName)
    : new PgHexBuilder(columnName);
};

const convertBigintColumn = (
  columnName: string,
  kind: "sqlite" | "postgres",
) => {
  return kind === "sqlite"
    ? new SQLiteBigintBuilder(columnName)
    : PgNumeric(columnName, { precision: 78 });
};

// TODO(kyle) list

const convertJsonColumn = (columnName: string, kind: "sqlite" | "postgres") => {
  return kind === "sqlite"
    ? new SQLiteJsonBuilder(columnName)
    : PgJsonb(columnName);
};

const convertEnumColumn = (columnName: string, kind: "sqlite" | "postgres") => {
  return kind === "sqlite" ? SQLiteText(columnName) : PgText(columnName);
};
