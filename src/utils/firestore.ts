export const serializeForFirestore = (data: any): any => {
  if (data instanceof RegExp) {
    return data.source;
  }
  if (Array.isArray(data)) {
    return data.map(serializeForFirestore);
  }
  if (typeof data === "object" && data !== null) {
    return Object.entries(data).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: serializeForFirestore(value),
      }),
      {}
    );
  }
  return data;
};
