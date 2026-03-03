import { useCalendarStore } from '@/stores/calendar.js';
import { storeToRefs } from 'pinia';

/**
 * Данные месяца для календаря (work-logs, absences, dayMap, factHours).
 * Все запросы к бэкенду выполняются через calendar store.
 */
export function useCalendarData() {
  const calendarStore = useCalendarStore();
  const { workLogs, absences, dayMap, factHours, dataLoading } = storeToRefs(calendarStore);

  return {
    workLogs,
    absences,
    dayMap,
    factHours,
    loading: dataLoading,
    fetchData: (year, month) => calendarStore.fetchMonthData(year, month),
  };
}
