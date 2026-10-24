import { PRReviewReport } from '../types';

export function formatJSON(report: PRReviewReport): string {
  return JSON.stringify(report, null, 2);
}
