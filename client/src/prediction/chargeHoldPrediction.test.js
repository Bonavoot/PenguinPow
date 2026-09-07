/**
 * Charge-hold release prediction gate.
 * Run: node --test client/src/prediction/chargeHoldPrediction.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHARGE_MIN_HOLD_MS,
  shouldPredictChargeRelease,
} from "./chargeHoldPrediction.js";

describe("shouldPredictChargeRelease", () => {
  it("rejects a tap before min hold (no lunge predict)", () => {
    assert.equal(
      shouldPredictChargeRelease({ chargeStartAt: 1000, now: 1000 + 50 }),
      false
    );
    assert.equal(
      shouldPredictChargeRelease({
        chargeStartAt: 1000,
        now: 1000 + CHARGE_MIN_HOLD_MS - 1,
      }),
      false
    );
  });

  it("allows release predict once min hold has elapsed", () => {
    assert.equal(
      shouldPredictChargeRelease({
        chargeStartAt: 1000,
        now: 1000 + CHARGE_MIN_HOLD_MS,
      }),
      true
    );
  });

  it("rejects missing charge-start stamp", () => {
    assert.equal(shouldPredictChargeRelease({ now: 2000 }), false);
    assert.equal(
      shouldPredictChargeRelease({ chargeStartAt: 0, now: 2000 }),
      false
    );
  });
});
