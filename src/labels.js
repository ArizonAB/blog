// @flow
declare var ALLOWED_LABELS: ?string;

const labels: ?string =
  typeof window === 'undefined' ? process.env.ALLOWED_LABELS : ALLOWED_LABELS;

export const allowedLabels = labels
  ? labels.split(',')
  : ['Publish', 'publish'];
