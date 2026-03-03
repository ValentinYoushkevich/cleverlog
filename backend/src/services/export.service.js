import ExcelJS from 'exceljs';
import { ReportService } from './report.service.js';

function styleHeader(worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  };
}

export const ExportService = {
  async exportUser(params) {
    const { rows } = await ReportService.userReport(params);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Отчёт по пользователю');

    worksheet.columns = [
      { header: 'Сотрудник', key: 'user_name', width: 24 },
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Тип записи', key: 'type', width: 16 },
      { header: 'Проект', key: 'project_name', width: 24 },
      { header: 'Task Number', key: 'task_number', width: 16 },
      { header: 'Длительность (ч)', key: 'duration_hours', width: 18 },
      { header: 'Комментарий', key: 'comment', width: 40 },
    ];

    for (const row of rows) {
      worksheet.addRow(row);
    }

    styleHeader(worksheet);
    return workbook;
  },

  async exportProject(params) {
    const { rows } = await ReportService.projectReport(params);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Отчёт по проекту');

    worksheet.columns = [
      { header: 'Сотрудник', key: 'user', width: 24 },
      { header: 'Должность', key: 'position', width: 20 },
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Проект', key: 'project_name', width: 24 },
      { header: 'Task Number', key: 'task_number', width: 16 },
      { header: 'Длительность (ч)', key: 'duration_hours', width: 18 },
      { header: 'Комментарий', key: 'comment', width: 40 },
    ];

    for (const row of rows) {
      worksheet.addRow(row);
    }

    styleHeader(worksheet);
    return workbook;
  },

  async exportMonthlySummary({ year, month }) {
    const {
      projects,
      rows,
      totals,
    } = await ReportService.monthlySummary({ year, month });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Сводный отчёт');

    worksheet.columns = [
      { header: 'Сотрудник', key: 'user_name', width: 24 },
      ...projects.map((project) => ({ header: project.name, key: `proj_${project.id}`, width: 16 })),
      { header: 'Отсутствие (ч)', key: 'absence_hours', width: 16 },
      { header: 'Факт (ч)', key: 'fact_hours', width: 14 },
    ];

    for (const row of rows) {
      const excelRow = {
        user_name: row.user_name,
        absence_hours: row.absence_hours,
        fact_hours: row.fact_hours,
      };

      for (const project of projects) {
        excelRow[`proj_${project.id}`] = row.by_project[project.id] || 0;
      }

      const addedRow = worksheet.addRow(excelRow);
      addedRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: row.is_on_norm ? 'FFD4EDDA' : 'FFFFF3CD' },
      };
    }

    const totalRow = {
      user_name: 'TOTAL',
      absence_hours: totals.absence_hours,
      fact_hours: totals.fact_hours,
    };
    for (const project of projects) {
      totalRow[`proj_${project.id}`] = totals.by_project[project.id] || 0;
    }
    const addedTotal = worksheet.addRow(totalRow);
    addedTotal.font = { bold: true };

    styleHeader(worksheet);
    return workbook;
  },

  async exportUnlogged({ year, month }) {
    const { users } = await ReportService.unlogged({ year, month });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Незаполненные дни');

    worksheet.columns = [
      { header: 'Сотрудник', key: 'user_name', width: 24 },
      { header: 'Незаполнено дней', key: 'unlogged_count', width: 18 },
      { header: 'Даты', key: 'unlogged_dates', width: 40 },
      { header: 'Факт (ч)', key: 'fact_hours', width: 14 },
      { header: 'Последний лог', key: 'last_log_date', width: 16 },
    ];

    for (const user of users) {
      worksheet.addRow({
        ...user,
        unlogged_dates: user.unlogged_dates.join(', '),
      });
    }

    styleHeader(worksheet);
    return workbook;
  },
};
