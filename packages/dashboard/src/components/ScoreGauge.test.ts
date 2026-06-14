import { describe, expect, it } from "vitest";
import { scoreGaugeBand } from "./ScoreGauge";

describe("scoreGaugeBand", () => {
  it("returns poor for scores below 50", () => {
    expect(scoreGaugeBand(46)).toBe("poor");
    expect(scoreGaugeBand(0)).toBe("poor");
    expect(scoreGaugeBand(49)).toBe("poor");
  });

  it("returns average for scores from 50 to 89", () => {
    expect(scoreGaugeBand(75)).toBe("average");
    expect(scoreGaugeBand(50)).toBe("average");
    expect(scoreGaugeBand(89)).toBe("average");
  });

  it("returns good for scores 90 and above", () => {
    expect(scoreGaugeBand(95)).toBe("good");
    expect(scoreGaugeBand(90)).toBe("good");
    expect(scoreGaugeBand(100)).toBe("good");
  });
});
