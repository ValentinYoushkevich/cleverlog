import { DEPARTMENTS } from '../constants/departments.js';

export const DirectoryController = {
  listDepartments(_req, res, next) {
    try {
      return res.json({ items: DEPARTMENTS });
    } catch (err) {
      return next(err);
    }
  },
};
