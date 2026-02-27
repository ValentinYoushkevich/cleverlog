import ExcelJS from 'exceljs';
import { AuditLogRepository } from '../repositories/auditLog.repository.js';

export const AuditLogService = {
  async list(filters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const result = await AuditLogRepository.findAll(filters);
    return {
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        total_pages: Math.ceil(result.total / limit) || 1,
      },
    };
  },

  async getFilterOptions() {
    const [event_types, entity_types] = await Promise.all([
      AuditLogRepository.getDistinctEventTypes(),
      AuditLogRepository.getDistinctEntityTypes(),
    ]);

    return { event_types, entity_types };
  },

  async export(filters) {
    const rows = await AuditLogRepository.findAllRaw(filters);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Журнал аудита');

    ws.columns = [
      { header: 'Время', key: 'timestamp', width: 22 },
      { header: 'Актор', key: 'actor', width: 28 },
      { header: 'Роль', key: 'actor_role', width: 12 },
      { header: 'Событие', key: 'event_type', width: 28 },
      { header: 'Сущность', key: 'entity_type', width: 20 },
      { header: 'ID сущности', key: 'entity_id', width: 38 },
      { header: 'IP', key: 'ip', width: 18 },
      { header: 'Результат', key: 'result', width: 12 },
    ];

    for (const row of rows) {
      ws.addRow({
        timestamp: new Date(row.timestamp).toLocaleString('ru-RU'),
        actor: row.actor_email
          ? `${row.last_name} ${row.first_name} (${row.actor_email})`
          : 'Система',
        actor_role: row.actor_role || '—',
        event_type: row.event_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id || '—',
        ip: row.ip || '—',
        result: row.result,
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    return wb;
  },
};
