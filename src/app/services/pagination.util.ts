export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  results?: T[];
}

export function firstPageParams() {
  return { page: '1', per_page: '100' };
}

export function extractList<T>(response: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.data || response.items || response.results || [];
}
