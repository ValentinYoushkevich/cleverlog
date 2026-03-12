import ExcelJS from 'exceljs';
import { AUDIT_ENTITY_LABEL } from '../constants/auditEntities.js';
import { AUDIT_EVENT_LABEL } from '../constants/auditEvents.js';
import { AuditLogRepository } from '../repositories/auditLog.repository.js';

function toEvent(type, labelFromDb) {
  const name = (labelFromDb && labelFromDb !== type)
    ? labelFromDb
    : (AUDIT_EVENT_LABEL[type] ?? type);
  return { type, name };
}

function toEntity(type) {
  if (!type) { return { type: null, name: '' }; }
  return { type, name: AUDIT_ENTITY_LABEL[type] ?? type };
}

function getSearchEntityTypes(search) {
  if (!search) { return []; }
  const searchLower = search.toLowerCase();
  return Object.entries(AUDIT_ENTITY_LABEL)
    .filter(([, label]) => label.toLowerCase().includes(searchLower))
    .map(([type]) => type);
}

function buildAuditWorksheet(rows) {
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
      actor: row.actor_email ? `${row.last_name} ${row.first_name} (${row.actor_email})` : 'Система',
      actor_role: row.actor_role || '—',
      event_type: `${toEvent(row.event_type, row.event_label).name} (${row.event_type})`,
      entity_type: toEntity(row.entity_type).name,
      entity_id: row.entity_id || '—',
      ip: row.ip || '—',
      result: row.result,
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  return wb;
}

export const AuditLogService = {
  async list(filters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const searchEntityTypes = getSearchEntityTypes(filters.search);
    const result = await AuditLogRepository.findAll({ ...filters, searchEntityTypes });
    const data = result.data.map((row) => ({
      ...row,
      event: toEvent(row.event_type, row.event_label),
      entity: toEntity(row.entity_type),
    }));
    return {
      data,
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

    return {
      event_types: event_types.map((row) => toEvent(row.event_type, row.event_label)),
      entity_types: entity_types.map((type) => toEntity(type)),
    };
  },

  async export(filters) {
    const searchEntityTypes = getSearchEntityTypes(filters.search);
    const rows = await AuditLogRepository.findAllRaw({ ...filters, searchEntityTypes });
    return buildAuditWorksheet(rows);
  },
};
