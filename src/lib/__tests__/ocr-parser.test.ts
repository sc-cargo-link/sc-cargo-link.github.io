import { describe, expect, it } from "vitest";
import { parseScannedContract } from "@/lib/ocr-parser";

describe("ocr-parser location cleaning", () => {
  it("strips on/at/to suffixes from dropoff locations", () => {
    const contract = parseScannedContract({
      nameText: "Test Haul",
      objectiveText: "Deliver 0/2 SCU of Waste to FaketownXYZ on Pyro Il.",
      rewardText: "1000",
    });

    const dropoff = contract.dropoffs[0];
    expect(dropoff.locationHint).toMatch(/faketownxyz/i);
    expect(dropoff.locationName).toBe("");
  });

  it("does not fill mission item when there is no exact match", () => {
    const contract = parseScannedContract({
      nameText: "Test",
      objectiveText: "Deliver 0/5 SCU of NotARealCargoItem to Lorville",
      rewardText: "",
    });

    expect(contract.dropoffs[0]?.items[0]?.name).toBe("");
    expect(contract.dropoffs[0]?.items[0]?.nameHint).toBe("NotARealCargoItem");
  });
});
