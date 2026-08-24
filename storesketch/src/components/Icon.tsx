import type { SVGProps } from 'react';

type IconName =
  | 'fileplus' | 'save' | 'folder' | 'imgplus' | 'imgdown' | 'pdf'
  | 'pointer' | 'multi' | 'pen' | 'wand' | 'line' | 'rect' | 'circle'
  | 'poly' | 'curve' | 'ruler' | 'calib' | 'text' | 'eraser' | 'trash'
  | 'undo' | 'redo' | 'grid' | 'snap' | 'clear' | 'eye' | 'eyeoff'
  | 'lock' | 'unlock' | 'chevron' | 'copy' | 'edit' | 'up' | 'down';

const paths: Record<IconName, string> = {
  fileplus: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  imgplus: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 14l4-4 3 3 2-2 7 6 M16 6v5 M13.5 8.5h5',
  imgdown: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 16l4-4 3 3 2-2 7 6 M12 4v6 M9 7l3 3 3-3',
  pdf: 'M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M15 2v6h6 M7 15h2a1.5 1.5 0 0 0 0-3H7v6 M12 18v-6h2a3 3 0 0 1 0 6z M18 12h-3v6',
  pointer: 'M5 3l14 9-6 1-3 7z', multi: 'M4 4h7v7H4z M13 13h7v7h-7z M13 4h7v7h-7z M4 13h7v7H4z',
  pen: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z M13.5 7.5l3 3',
  wand: 'M15 4l5 5 M13 6l5 5 M4 20l7-7 M5 4v4 M3 6h4 M17 16v4 M15 18h4',
  line: 'M5 19L19 5', rect: 'M4 4h16v16H4z', circle: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  poly: 'M4 18l4-8 5 4 7-9', curve: 'M4 18c5-12 10-12 16 0', ruler: 'M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  calib: 'M4 4h16v16H4z M8 12h8 M12 8v8', text: 'M4 5h16 M12 5v14 M8 19h8',
  eraser: 'M18.5 19.5H9.5L4.7 14.7a2 2 0 0 1 0-2.9l7.4-7.4a2 2 0 0 1 2.9 0l4.3 4.3a2 2 0 0 1 0 2.9L12 19 M8.2 9.2l6.6 6.6', trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 14h10l1-14 M9 7V3h6v4',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 6 6v2', redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0-6 6v2',
  grid: 'M4 4h16v16H4z M4 10h16 M10 4v16', snap: 'M12 3v18 M3 12h18 M7 7h10v10H7z', clear: 'M5 5l14 14 M19 5L5 19',
  eye: 'M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', eyeoff: 'M3 3l18 18 M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 10 6 10 6a18 18 0 0 1-3 3.8 M6.7 6.7C3.6 8.5 2 12 2 12s3 6 10 6a10 10 0 0 0 3.3-.5',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3 M5 10h14v11H5z M12 14v3', unlock: 'M18 10V7a6 6 0 0 0-11.5-2 M5 10h14v11H5z M12 14v3', chevron: 'M6 9l6 6 6-6',
  copy: 'M8 8h11v11H8z M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  edit: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z M13.5 7.5l3 3',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg {...props} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
