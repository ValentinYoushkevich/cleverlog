CopyCleverLog — Frontend: список модулей (v2)
0. Инициализация проекта
npm create vue@latest (Vue 3, Vue Router, Pinia). Установка: PrimeVue 4 + PrimeIcons + Aura, Tailwind CSS + tailwindcss-primeui, @vueuse/core, axios, dayjs, vee-validate + zod. Настройка PrimeVue в main.js (preset Aura, ripple, ToastService, ConfirmationService). Настройка Tailwind. Алиасы путей (@/), переменные окружения (VITE_API_URL). App.vue с <Toast> и <ConfirmDialog>.

1. Роутер и layouts
Vue Router: публичные (/login, /register/:token), защищённые (остальные). AuthLayout (центрированная форма) и AppLayout (sidebar + header + main, PrimeVue Menubar/Drawer). Navigation guard: редирект на /login если нет сессии; редирект на / если авторизован. Плейсхолдеры всех страниц.

2. Pinia — глобальные сторы
useAuthStore — пользователь, роль, login/logout/fetchMe. useCalendarStore — данные месяца, норма, isClosed. useProjectsStore — список проектов, activeProjects. useUiStore — глобальный loading overlay. Toast через useToast() напрямую.

3. Аутентификация
/login — InputText + Password + Button, live-валидация vee-validate + zod, обработка серверных ошибок (ACCOUNT_LOCKED, ACCOUNT_INACTIVE). /register/:token — Password с индикатором силы (5 критериев), кнопка заблокирована до выполнения всех условий.

4. Профиль пользователя
/profile — два Card: редактирование имени/фамилии/должности (после сохранения fetchMe обновляет сайдбар); смена пароля с индикатором силы и обработкой INVALID_PASSWORD.

5. Work Logs
Форма: DatePicker (maxDate=сегодня), Select проекта (только Active), InputText длительности (парсинг 1h 30m / 2d / 45m в composable), Task Number, Textarea, динамические кастомные поля проекта. Предупреждение при >12h (Toast, не блокирует). Список: DataTable с фильтрами, сортировкой, пагинацией. Редактирование через Dialog, удаление через ConfirmDialog.

6. Absences
Форма: Select типа (Vacation / Sick Leave / Day Off), DatePicker range (disabledDates = выходные), Textarea. После submit — Dialog с пропущенными днями (конфликты с Work Logs / выходными). Список: DataTable с фильтрами. Редактирование/удаление через Dialog + ConfirmDialog.

7. Календарь пользователя
/calendar — кастомная месячная сетка на Tailwind. Цвета: зелёный (Work Logs), синий (Absence), красный (рабочий без записей), серый (выходной). Клик на день → Drawer со списком записей и формами добавления/редактирования. Шапка: норма / факт / отклонение / статус месяца. Блокировка действий при закрытом месяце (read-only для User).

8. Отчёт по пользователю
/reports/user — фильтры (Select, DatePicker, InputText), DataTable (Дата, Тип, Проект, Task Number, Длительность, Комментарий). При полном месяце — SummaryBlock (Норма / Факт / Отклонение / Незаполненные дни). Плашки итогов по проектам. Кнопка «Экспорт Excel».

9. Отчёт по проекту (Admin)
/reports/project — фильтры (проект, период, сотрудник, Task Number), DataTable (Сотрудник, Должность, Дата, Проект, Task Number, Длительность, Комментарий). Итоги по пользователям. Кнопка «Экспорт Excel».

10. Свод по месяцу (Admin)
/reports/monthly-summary — выбор месяца, DataTable с динамическими колонками (проекты + Absence + Факт + Норма + Отклонение), frozen первая колонка (сотрудник), итоговая строка TOTAL, rowClass (зелёный = норма, жёлтый = отклонение). Кнопка «Экспорт Excel».

11. Дашборд (Admin)
/dashboard — DatePicker выбора месяца. Три кликабельных Card (недоработка / переработка / незаполненные дни). По клику — UserListDialog с DataTable (Сотрудник, Факт, Absence, TOP-2 проектов, незаполненные дни, последний лог). Два ProjectPieChart (часы по проектам; распределение %). UnloggedWidget с кнопкой экспорта.

12. Управление пользователями (Admin)
/admin/users — DataTable с фильтрами (статус, роль, теги; Inactive скрыты по умолчанию). «Пригласить» — Dialog (имя, фамилия, email, роль, должность, дата найма, теги через InputChips). Редактирование — Dialog. Смена статуса Active ↔ Inactive — ConfirmDialog.

13. Управление проектами (Admin)
/admin/projects — DataTable с фильтром по статусу. Создание/редактирование — Dialog. Смена статуса (Active / On Hold / Closed). Переход к настройке кастомных полей проекта.

14. Кастомные поля (Admin)
/admin/custom-fields — DataTable со всеми полями (включая soft-deleted с визуальным отличием). Создание — Dialog (Select типа, для Dropdown — InputChips для опций). Привязка к проектам — MultiSelect. Переименование инлайн. Soft delete / восстановление через ConfirmDialog. Запрет смены типа — Message с объяснением.

15. Управление календарём (Admin)
/admin/calendar — кастомная месячная сетка (как модуль 7). Клик на день — ConfirmDialog смены статуса (рабочий / выходной / праздник). Поле нормы — InputNumber + Button. Визуальные индикаторы изменённых дней. Message: смена статуса не удаляет данные.

16. Закрытие месяца (Admin)
Кнопка закрытия/открытия в AppLayout или на отдельной странице — Button + ConfirmDialog с объяснением последствий. Tag со статусом месяца (открыт/закрыт) в шапке.

17. Журнал аудита (Admin)
/admin/audit-logs — DataTable с фильтрами (actor, event_type, entity_type, период, ip, result, поиск), пагинация, lazy режим. Детальный просмотр (before/after JSON) — Dialog с pre-блоком. Кнопка «Экспорт Excel».

18. Уведомления (Admin)
/admin/notifications — глобальный ToggleSwitch рассылки. DataTable пользователей с колонкой ToggleSwitch per-user.

19. Логирование JS-ошибок
Глобальный обработчик: app.config.errorHandler + window.onerror + unhandledrejection → POST /api/log-js-error. Без UI-компонента.

20. RBAC — финальный модуль
Composable usePermissions — скрытие элементов UI по роли (v-if). Navigation guard: запрет Admin-страниц для User. Скрытие Admin-only элементов (дашборд, управление пользователями/проектами/полями/календарём, закрытие месяца, аудит, уведомления, колонка «Пользователь» в экспорте). Финальное тестирование по матрице RBAC.