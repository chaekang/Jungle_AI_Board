import { readFileSync } from "node:fs"
import { buildTheaterSeatMapSearchParams } from "./theater-seat-map-search.ts"

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

assertDeepEqual(buildTheaterSeatMapSearchParams("blue-square"), {
  page: 1,
  limit: 50,
  theaterId: "blue-square",
  sort: "latest",
})

const seatMapSource = readFileSync(
  new URL("./components/TheaterSeatMap.tsx", import.meta.url),
  "utf8",
)

if (!/className="theater-seat-map-modal-backdrop"[\s\S]*aria-label="좌석 후기 닫기"[\s\S]*onClick=\{\(\) => setSelectedSeatKey\(null\)\}/.test(seatMapSource)) {
  throw new Error("Seat review modal must close when its backdrop is clicked")
}

console.log("theater-seat-map-search tests passed.")
