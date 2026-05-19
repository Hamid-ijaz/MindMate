/**
 * Validates milestone date ranges using millisecond timestamps.
 * Returns true when endDate is missing, null, equal to, or after originalDate.
 * A same-day milestone (endDate === originalDate) is treated as valid.
 */
export const isValidMilestoneDateRange = (
  originalDate: number,
  endDate: number | null | undefined
): boolean => {
  if (endDate === null || endDate === undefined) {
    return true;
  }

  return endDate >= originalDate;
};
