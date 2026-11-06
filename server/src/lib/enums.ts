// The API uses lowercase values ('dark', 'friends'); the database enums are uppercase.
export const toApi = <T extends string>(value: string) => value.toLowerCase() as T;
export const toDb = <T extends string>(value: string) => value.toUpperCase() as T;
