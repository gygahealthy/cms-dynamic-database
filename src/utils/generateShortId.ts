/**
 * Generates a short unique identifier (10 characters max)
 * @returns {string} A short unique identifier
 */
export const generateShortId = (): string => {
  return Math.random().toString(36).substring(2, 12);
};
