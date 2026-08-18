export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const timeConstant = d => Math.max(d, 0.001) / 3;

export function cancelHold(param, t) {
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(t);
  } else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}
