import type { SVGProps } from 'react';

type IconName =
  | 'fileplus' | 'save' | 'folder' | 'imgplus' | 'imgdown' | 'pdf'
  | 'pointer' | 'multi' | 'pen' | 'wand' | 'line' | 'rect' | 'circle'
  | 'poly' | 'curve' | 'ruler' | 'calib' | 'text' | 'eraser' | 'trash'
  | 'undo' | 'redo' | 'grid' | 'snap' | 'clear' | 'eye' | 'eyeoff'
  | 'lock' | 'unlock' | 'chevron' | 'copy' | 'edit' | 'up' | 'down' | 'shop' | 'osnap';

const paths: Record<IconName, string> = {
  fileplus: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  imgplus: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 14l4-4 3 3 2-2 7 6 M16 6v5 M13.5 8.5h5',
  imgdown: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 16l4-4 3 3 2-2 7 6 M12 4v6 M9 7l3 3 3-3',
  pdf: 'M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M15 2v6h6 M7 15h2a1.5 1.5 0 0 0 0-3H7v6 M12 18v-6h2a3 3 0 0 1 0 6z M18 12h-3v6',
  pointer: 'M5 3l14 8-6.5 1.5L9 19z', multi: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8 M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8 M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16 M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16 M12 9v6 M9 12h6',
  pen: 'M4 20l1.5-5L16 4.5a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5z M14 6.5l3.5 3.5',
  wand: 'M4 20L14 10 M14 10l-1.5-1.5 3-3L17 7z M18.5 2.5v3 M17 4h3 M20 12v2 M19 13h2',
  line: 'M4 20L20 4', rect: 'M4 6h16v12H4z', circle: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  poly: 'M4 18L9 7l5 7 6-10', curve: 'M3.5 18.5C7 7 17 7 20.5 18.5', ruler: 'M2.5 8h19v8h-19z M7 8v3 M11 8v4 M15 8v3 M19 8v4',
  calib: 'M5 19L19 5 M9.5 12.5l2 2 M13 9l2 2', text: 'M5 7V4.5h14V7 M12 4.5V20 M9 20h6',
  eraser: 'M18.5 19.5H9.5L4.7 14.7a2 2 0 0 1 0-2.9l7.4-7.4a2 2 0 0 1 2.9 0l4.3 4.3a2 2 0 0 1 0 2.9L12 19 M8.2 9.2l6.6 6.6', trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 14h10l1-14 M9 7V3h6v4',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 6 6v2', redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0-6 6v2',
  grid: 'M4 9h16 M4 15h16 M9 4v16 M15 4v16', snap: 'M6 4v7a6 6 0 0 0 12 0V4 M6 4h4v5 M14 9V4h4', clear: 'M9 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-6-6z M12.5 10l4 4 M16.5 10l-4 4',
  eye: 'M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', eyeoff: 'M3 3l18 18 M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 10 6 10 6a18 18 0 0 1-3 3.8 M6.7 6.7C3.6 8.5 2 12 2 12s3 6 10 6a10 10 0 0 0 3.3-.5',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3 M5 10h14v11H5z M12 14v3', unlock: 'M18 10V7a6 6 0 0 0-11.5-2 M5 10h14v11H5z M12 14v3', chevron: 'M6 9l6 6 6-6',
  copy: 'M8 8h11v11H8z M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  edit: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z M13.5 7.5l3 3',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  shop: 'M4 9V7.5L6 4h12l2 3.5V9 M4 9a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0A2.2 2.2 0 0 0 20 9 M5.5 11.5V20h13v-8.5 M9.5 20v-4.5h5V20',
  osnap: 'M8.5 17.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M19.5 6.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M8 16l8-8 M12 6.5a5.5 5.5 0 1 1 0 11',
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg {...props} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
