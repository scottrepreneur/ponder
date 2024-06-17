import type { ReadonlyStore } from "@/indexing-store/store.js";
import type { Schema } from "@/schema/common.js";
import { getTables } from "@/schema/utils.js";
import {
  type GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import type { GetLoader } from "./buildLoaderCache.js";
import { buildEntityTypes } from "./entity.js";
import { buildEnumTypes } from "./enum.js";
import { buildEntityFilterTypes } from "./filter.js";
import { buildPluralField } from "./plural.js";
import { buildSingularField } from "./singular.js";

// TODO(kyle) stricter type
export type Parent = Record<string, any>;
export type Context = { store: ReadonlyStore; getLoader: GetLoader };

export const buildGraphQLSchema = (schema: Schema): GraphQLSchema => {
  const queryFields: Record<string, GraphQLFieldConfig<Parent, Context>> = {};

  const { enumTypes } = buildEnumTypes({ schema });
  const { entityFilterTypes } = buildEntityFilterTypes({ schema, enumTypes });
  const { entityTypes, entityPageTypes } = buildEntityTypes({
    schema,
    enumTypes,
    entityFilterTypes,
  });

  for (const [tableName, { table }] of Object.entries(getTables(schema))) {
    const entityType = entityTypes[tableName]!;
    const entityPageType = entityPageTypes[tableName]!;
    const entityFilterType = entityFilterTypes[tableName]!;

    const singularFieldName =
      tableName.charAt(0).toLowerCase() + tableName.slice(1);
    queryFields[singularFieldName] = buildSingularField({
      tableName,
      table,
      entityType,
    });

    const pluralFieldName = `${singularFieldName}s`;
    queryFields[pluralFieldName] = buildPluralField({
      tableName,
      entityPageType,
      entityFilterType,
    });
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: queryFields,
    }),
  });
};
