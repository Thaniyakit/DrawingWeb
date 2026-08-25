export type ChecklistInputDefinition = {
  key: string;
  placeholder: string;
};

export type ChecklistDefinition = {
  title: string;
  inputs?: ChecklistInputDefinition[];
  options?: string[];
};

// Mirrors the 25-item checklist from the reference storesketch_6.html.
export const CHECKLIST_ITEMS: ChecklistDefinition[] = [
  { title: 'รูปแบบร้าน', inputs: [{ key: 'v', placeholder: 'ระบุรูปแบบ' }] },
  { title: 'แนวเขตที่ดิน' },
  { title: 'ระยะร่นอาคาร' },
  { title: 'ค่าระดับร้าน' },
  { title: 'ร้านค้า 7-ชุมชน' },
  { title: 'ที่จอดรถ', inputs: [{ key: 'car', placeholder: 'รถยนต์' }, { key: 'moto', placeholder: 'จักรยานยนต์' }] },
  { title: 'แนวท่อน้ำทิ้ง' },
  { title: 'บ่อซึม', inputs: [{ key: 'n', placeholder: 'จำนวน' }] },
  { title: 'จุดเชื่อมทาง', options: ['Concrete', 'Asphalt'] },
  { title: 'วางท่อเชื่อมทาง', inputs: [{ key: 'dia', placeholder: 'Ø ท่อ (m.)' }], options: ['ฝาเหล็ก', 'ฝาคอนกรีต'] },
  { title: 'กำแพงกันดิน' },
  { title: 'เสา Pole Sign', options: ['เสา 6 m', 'เสา 8 m', 'เสา 10 m', 'เสา 12 m', 'ป้าย 1.50x1.50 m', 'ป้าย 2.20x2.20 m'] },
  { title: 'เสาหม้อแปลง' },
  { title: 'เสารับสายเมน' },
  { title: 'มิเตอร์น้ำประปา' },
  { title: 'แนวรั้ว', options: ['กัลวาไนซ์', 'รั้วทึบ'] },
  { title: 'ขอบคันหิน' },
  { title: 'จุดวางคอยล์ร้อน' },
  { title: 'ถังน้ำ', inputs: [{ key: 'l350', placeholder: '350L' }, { key: 'l550', placeholder: '550L' }, { key: 'l1000', placeholder: '1,000L' }] },
  { title: 'ห้องอเนกประสงค์' },
  { title: 'ข้อมูล TOPO', options: ['มี', 'ไม่มี'] },
  { title: 'ร้านใกล้ชายทะเล', options: ['ใช่', 'ไม่ใช่'] },
  { title: 'ร้านสู้น้ำ', options: ['ใช่', 'ไม่ใช่'] },
  { title: 'ห้องน้ำร้านค้าเช่า' },
  { title: 'พื้นที่ Phase 2', options: ['มี', 'ไม่มี'] },
];
