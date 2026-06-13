import { mergeSeatOptions } from "./seat-layout-options.ts";

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

assertDeepEqual(
  mergeSeatOptions(undefined, ["1", "2"], "열"),
  [
    { value: "1", label: "1열" },
    { value: "2", label: "2열" },
  ],
);

assertDeepEqual(
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
