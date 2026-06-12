// @ts-nocheck
import assert from "node:assert/strict";
import { mergeSeatOptions } from "./seat-layout-options.ts";

assert.deepEqual(
  mergeSeatOptions(undefined, ["1", "2"], "열"),
  [
    { value: "1", label: "1열" },
    { value: "2", label: "2열" },
  ],
);

assert.deepEqual(
  mergeSeatOptions(
    [
      { value: "1", label: "1열" },
      { value: "2", label: "2열" },
    ],
    ["2", "3"],
    "열",
  ),
  [
    { value: "1", label: "1열" },
    { value: "2", label: "2열" },
    { value: "3", label: "3열" },
  ],
);

console.log("seat-layout-options tests passed.");
