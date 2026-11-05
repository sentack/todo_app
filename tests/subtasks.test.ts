import { describe, it, expect } from "vitest"
import { cleanWeightInput, stepWeight, parseWeight, invalidWeightIndexes } from "@/lib/subtasks"

describe("subtask weights", () => {
  it("typing accepts any whole number from 0 up", () => {
    expect(cleanWeightInput("0")).toBe("0")
    expect(cleanWeightInput("")).toBe("")
    expect(cleanWeightInput("12")).toBe("12")
    expect(cleanWeightInput("007")).toBe("7")
    expect(cleanWeightInput("-3")).toBe("3")      // no negatives
    expect(cleanWeightInput("2.5")).toBe("25")    // whole numbers only
    expect(cleanWeightInput("4a")).toBe("4")
  })

  it("− / + step by one and never go below 0", () => {
    expect(stepWeight("1", -1)).toBe("0")
    expect(stepWeight("0", -1)).toBe("0")
    expect(stepWeight("", 1)).toBe("1")
    expect(stepWeight("3", 1)).toBe("4")
  })

  it("only 1–5 can be saved", () => {
    expect([0, 1, 3, 5, 6].map(n => parseWeight(String(n)))).toEqual([null, 1, 3, 5, null])
    expect(parseWeight("")).toBeNull()
  })

  it("flags titled subtasks with a bad weight; untitled ones are skipped anyway", () => {
    expect(invalidWeightIndexes([
      { title: "Plan", weight: "2" },
      { title: "Build", weight: "0" },
      { title: "", weight: "9" },       // not saved, so not an error
      { title: "Ship", weight: "" },
      { title: "Test", weight: "6" },
    ])).toEqual([1, 3, 4])
  })
})
