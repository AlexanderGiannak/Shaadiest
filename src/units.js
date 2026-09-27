export const miles = meters => meters / 1609.344;
export const fahrenheit = celsius => celsius * 9 / 5 + 32;
export const formatDistance = meters => meters >= 160.9344
  ? `${miles(meters).toFixed(2)} mi`
  : `${Math.round(meters / 0.3048)} ft`;
