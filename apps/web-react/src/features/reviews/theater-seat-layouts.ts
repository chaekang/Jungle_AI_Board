import type { TheaterOption, TheaterSeatLayout } from "./types"

const abcSections = [
  { value: "A", label: "A구역" },
  { value: "B", label: "B구역" },
  { value: "C", label: "C구역" },
]

const defSections = [
  { value: "D", label: "D구역" },
  { value: "E", label: "E구역" },
  { value: "F", label: "F구역" },
]

const aisleBasedAiBlocks = [
  { value: "left", label: "왼쪽블록" },
  { value: "center", label: "중앙블록" },
  { value: "right", label: "오른쪽블록" },
]

const twoFloorAbcLayout: TheaterSeatLayout = {
  floors: [
    { value: "1층", label: "1층" },
    { value: "2층", label: "2층" },
  ],
  sectionsByFloor: {
    "1층": abcSections,
    "2층": abcSections,
  },
}

const doosanArtCenterLayout: TheaterSeatLayout = {
  floors: [
    { value: "1층", label: "1층" },
    { value: "2층", label: "2층" },
  ],
  sectionsByFloor: {
    "1층": abcSections,
    "2층": defSections,
  },
}

const twoFloorNoOfficialSectionsLayout: TheaterSeatLayout = {
  floors: [
    { value: "1층", label: "1층" },
    { value: "2층", label: "2층" },
  ],
  sectionsByFloor: {},
  aiBlocksByFloor: {
    "1층": aisleBasedAiBlocks,
    "2층": aisleBasedAiBlocks,
  },
}

const blueSquareLayout: TheaterSeatLayout = {
  floors: [
    { value: "1층", label: "1층" },
    { value: "2층", label: "2층" },
    { value: "3층", label: "3층" },
  ],
  sectionsByFloor: {
    "1층": abcSections,
    "2층": abcSections,
    "3층": abcSections,
  },
}

const theaterLayoutsByName: Record<string, TheaterSeatLayout> = {
  샤롯데씨어터: twoFloorAbcLayout,
  "Charlotte Theater": twoFloorAbcLayout,
  두산아트센터: doosanArtCenterLayout,
  "홍익대 대학로 아트센터": twoFloorAbcLayout,
  "광림아트센터 BBCH홀": twoFloorNoOfficialSectionsLayout,
  "YES24 Stage": twoFloorNoOfficialSectionsLayout,
  YES24스테이지: twoFloorNoOfficialSectionsLayout,
  예스24스테이지: twoFloorNoOfficialSectionsLayout,
  "예스24스테이지 1관": twoFloorNoOfficialSectionsLayout,
  "예스24스테이지 2관": twoFloorNoOfficialSectionsLayout,
  "예스24스테이지 3관": twoFloorNoOfficialSectionsLayout,
  "Blue Square": blueSquareLayout,
  블루스퀘어: blueSquareLayout,
}

export function getTheaterSeatLayout(theater: TheaterOption | null): TheaterSeatLayout {
  if (!theater) {
    return twoFloorAbcLayout
  }

  return theaterLayoutsByName[theater.name] ?? twoFloorAbcLayout
}
