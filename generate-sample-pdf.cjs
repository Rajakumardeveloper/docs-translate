const fs = require('fs');

function createSamplePdf() {
  const title = 'THE DAILY CHRONICLE';
  const date = 'Wednesday, October 21, 2026';
  const headline = 'CABINET APPROVES HISTORIC INFRASTRUCTURE REFORMS';
  const subhead = 'New economic policy aims to accelerate growth and boost domestic employment';

  const contentStream = [
    'BT',
    '/F2 24 Tf',
    '50 780 Td',
    `(${title}) Tj`,
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 762 Td',
    `(${date} | National Affairs & Editorial Section | Vol. XLVIII No. 284) Tj`,
    'ET',
    '0.5 w',
    '50 750 m',
    '545 750 l',
    'S',
    'BT',
    '/F2 15 Tf',
    '50 720 Td',
    `(${headline}) Tj`,
    'ET',
    'BT',
    '/F2 10.5 Tf',
    '50 702 Td',
    `(${subhead}) Tj`,
    'ET',
    '0.3 w',
    '50 692 m',
    '545 692 l',
    'S',
    // Column 1
    'BT',
    '/F1 10 Tf',
    '14 TL',
    '50 670 Td',
    '(NEW DELHI: The Union Cabinet on Wednesday approved) Tj T*',
    '(a historic package of comprehensive economic reforms) Tj T*',
    '(designed to enhance national infrastructure, expand) Tj T*',
    '(industrial capacity, and stimulate sustainable growth.) Tj T*',
    '(Speaking at a press conference, the Finance Minister) Tj T*',
    '(emphasized that the new policy will create millions) Tj T*',
    '(of skilled jobs and strengthen our resilient) Tj T*',
    '(manufacturing ecosystem against global headwinds.) Tj T*',
    '() Tj T*',
    '(The Constitution of India guarantees fundamental rights) Tj T*',
    '(and economic justice for every citizen. Under the) Tj T*',
    '(ambitious roadmap, substantial investments will flow) Tj T*',
    '(into high-speed railways, digital connectivity, and) Tj T*',
    '(clean energy projects across rural and urban centers.) Tj T*',
    '() Tj T*',
    '(Special provisions have been included for renewable) Tj T*',
    '(energy adoption and modern semiconductor production.) Tj T*',
    'ET',
    // Column 2
    'BT',
    '/F1 10 Tf',
    '14 TL',
    '300 670 Td',
    '(Industry leaders and economists welcomed the bold) Tj T*',
    '(measures. This strategic initiative demonstrates) Tj T*',
    '(strong governance and fiscal discipline, said a) Tj T*',
    '(senior analyst at the Reserve Bank of India.) Tj T*',
    '(Domestic demand has shown remarkable strength) Tj T*',
    '(despite international inflation and supply shocks.) Tj T*',
    '() Tj T*',
    '(The government also announced special incentives) Tj T*',
    '(for technology startups, agricultural logistics, and) Tj T*',
    '(youth skill development programs. With inflation) Tj T*',
    '(stabilizing within the target band, the national) Tj T*',
    '(economy is poised for accelerated progress.) Tj T*',
    '() Tj T*',
    '(State governments expressed positive enthusiasm) Tj T*',
    '(for collaborative development partnerships.) Tj T*',
    'ET',
    // Footer
    '0.5 w',
    '50 80 m',
    '545 80 l',
    'S',
    'BT',
    '/F1 9 Tf',
    '50 65 Td',
    '(ReadHindi - Newspaper PDF Reader for Students | Tap any word to view Hindi meaning) Tj',
    'ET'
  ].join('\n');

  const streamBytes = Buffer.from(contentStream, 'utf8');

  let buffer = Buffer.from('%PDF-1.4\n');
  const objOffsets = [];

  function appendObj(str) {
    objOffsets.push(buffer.length);
    buffer = Buffer.concat([buffer, Buffer.from(str)]);
  }

  appendObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  appendObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  appendObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n');
  appendObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  appendObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  objOffsets.push(buffer.length);
  buffer = Buffer.concat([
    buffer,
    Buffer.from(`6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
    streamBytes,
    Buffer.from('\nendstream\nendobj\n')
  ]);

  const xrefOffset = buffer.length;
  let xref = `xref\n0 ${objOffsets.length + 1}\n0000000000 65535 f \r\n`;
  for (const off of objOffsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n \r\n';
  }
  const trailer = `trailer\n<< /Size ${objOffsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  buffer = Buffer.concat([buffer, Buffer.from(xref), Buffer.from(trailer)]);

  fs.writeFileSync('public/sample-newspaper.pdf', buffer);
  console.log('Sample PDF successfully created at public/sample-newspaper.pdf, size:', buffer.length);
}

createSamplePdf();
