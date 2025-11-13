// JSON Server Client Utility
// Provides functions to interact with json-server mock API

const JSON_SERVER_URL = process.env.NEXT_PUBLIC_JSON_SERVER_URL || 'http://localhost:3001';

interface FilterParams {
  [key: string]: string | number | boolean | Date | undefined;
}

/**
 * Fetch data from json-server
 */
export async function fetchFromJsonServer<T>(
  endpoint: string,
  params?: FilterParams
): Promise<T> {
  try {
    const url = new URL(`${JSON_SERVER_URL}/${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`JSON Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Filter array by date range
 */
export function filterByDateRange<T extends Record<string, any>>(
  items: T[],
  dateField: string,
  startDate: Date,
  endDate: Date
): T[] {
  return items.filter(item => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= startDate && itemDate <= endDate;
  });
}

/**
 * Get date range from string
 */
export function getDateRangeFromString(
  dateRange: string,
  currentDate: string = new Date().toISOString().split('T')[0]
): { startDate: Date; endDate: Date } {
  const current = new Date(currentDate);
  let startDate: Date;
  let endDate: Date = new Date(current);

  switch(dateRange) {
    case 'today':
      startDate = new Date(current);
      endDate = new Date(current);
      break;
    case 'yesterday':
      startDate = new Date(current);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      break;
    case 'thisWeek':
      startDate = new Date(current);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case 'lastWeek':
      startDate = new Date(current);
      startDate.setDate(startDate.getDate() - 13);
      endDate = new Date(current);
      endDate.setDate(endDate.getDate() - 7);
      break;
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1);
      break;
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      endDate = new Date(current.getFullYear(), current.getMonth(), 0);
      break;
    case 'thisQuarter':
      const currentQuarter = Math.floor(current.getMonth() / 3);
      startDate = new Date(current.getFullYear(), currentQuarter * 3, 1);
      break;
    case 'lastQuarter':
      const lastQuarter = Math.floor(current.getMonth() / 3) - 1;
      startDate = new Date(current.getFullYear(), lastQuarter * 3, 1);
      endDate = new Date(current.getFullYear(), (lastQuarter + 1) * 3, 0);
      break;
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1);
      break;
    case 'last30Days':
    case 'last30days':
    default:
      startDate = new Date(current);
      startDate.setDate(startDate.getDate() - 29);
  }

  return { startDate, endDate };
}
