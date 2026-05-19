export const isValidMilestoneDateRange = (
  originalDate: number,
  endDate: number | null | undefined
): boolean => {
  if (endDate === null || endDate === undefined) {
    return true;
  }

  return endDate >= originalDate;
};
