// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import { dsvFormat, csvParseRows, tsvParseRows } from "d3-dsv";

import { inferAndConvertColumn } from "./data_types";
import {
  Row,
  Table,
  rawColumnPostFix,
  DataValue,
  DataType,
  ColumnMetadata
} from "./dataset";
import { deepClone } from "../common";

export function parseHints(hints: string) {
  const items = hints.match(/ *\*(.*)/);
  if (items) {
    const entries = items[1]
      .trim()
      .split(";")
      .map(x => x.trim())
      .filter(x => x != "");
    const result: { [name: string]: string } = {};
    for (const entry of entries) {
      const items = entry.split(":").map(x => x.trim());
      if (items.length == 2) {
        result[items[0]] = items[1];
      } else if (items.length == 1) {
        result[items[0]] = "true";
      }
    }
    return result;
  } else {
    return {};
  }
}

export function getLocalListSeparator(): string {
  return ["", ""].toLocaleString();
}

export function parseDataset(
  fileName: string,
  content: string,
  type: "csv" | "tsv"
): Table {
  let rows: string[][];
  switch (type) {
    case "csv":
      {
        rows = dsvFormat(getLocalListSeparator()).parseRows(content);
      }
      break;
    case "tsv":
      {
        rows = tsvParseRows(content);
      }
      break;
    default:
      {
        rows = [[]];
      }
      break;
  }

  // Remove empty rows if any
  rows = rows.filter(row => row.length > 0);

  if (rows.length > 0) {
    const header = rows[0];
    let columnHints: Array<{ [name: string]: string }>;
    let data = rows.slice(1);
    if (data.length > 0 && data[0].every(x => /^ *\*/.test(x))) {
      columnHints = data[0].map(parseHints);
      data = data.slice(1);
    } else {
      columnHints = header.map(x => ({}));
    }

    let columnValues = header.map((name, index) => {
      const values = data.map(row => row[index]);
      return inferAndConvertColumn(values);
    });

    const additionalColumns: Array<{
      values: DataValue[];
      rawValues?: string[] | DataValue[];
      type: DataType;
      metadata: ColumnMetadata;
    }> = [];
    columnValues.forEach((column, index) => {
      if (column.rawValues) {
        const rawColumn = deepClone(column);
        rawColumn.metadata.isRaw = true;
        rawColumn.values = rawColumn.rawValues;
        delete rawColumn.rawValues;
        const rawColumnName = header[index] + rawColumnPostFix;
        column.metadata.rawColumnName = rawColumnName;
        delete column.rawValues;
        header.push(rawColumnName);
        additionalColumns.push(rawColumn);
      }
    });
    columnValues = columnValues.concat(additionalColumns);

    const outRows = data.map((row, rindex) => {
      const out: Row = { _id: rindex.toString() };
      columnValues.forEach((column, cindex) => {
        out[header[cindex]] = columnValues[cindex].values[rindex];
        if (columnValues[cindex].rawValues) {
          out[header[cindex] + rawColumnPostFix] =
            columnValues[cindex].rawValues[rindex];
          if (!header.find(h => h === header[cindex] + rawColumnPostFix)) {
            header.push(header[cindex] + rawColumnPostFix);
          }
        }
      });
      return out;
    });

    const columns = columnValues.map((x, i) => ({
      name: header[i],
      displayName: header[i],
      type: x.type,
      metadata: x.metadata
    }));

    return {
      name: fileName,
      displayName: fileName,
      columns,
      rows: outRows,
      type: null
    };
  } else {
    return null;
  }
}
