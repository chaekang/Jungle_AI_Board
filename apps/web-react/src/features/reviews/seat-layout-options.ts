import type { SeatOption } from "./types"

export function makeSeatOption(value: string, suffix = ""): SeatOption {
  return {
    value,
    label: suffix ? `${value}${suffix}` : value,
  }
}

export function mergeSeatOptions(
  currentOptions: SeatOption[] | undefined,
  values: string[],
  suffix = "",
) {
  const optionMap = new Map<string, SeatOption>()

  currentOptions?.forEach((option) => {
    optionMap.set(option.value, option)
  })

  values.forEach((value) => {
    if (!optionMap.has(value)) {
      optionMap.set(value, makeSeatOption(value, suffix))
    }
  })

  return Array.from(optionMap.values())
}
