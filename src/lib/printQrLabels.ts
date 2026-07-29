import { generateQrCodeSvgMarkup } from '../components/QrCodeLabel';

export async function printQrLabels(items: { inventoryCode: string; item: string }[]) {
  const withCodes = items.filter((i) => i.inventoryCode);
  if (withCodes.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=420,height=420');
  if (!printWindow) return;

  const labels = await Promise.all(
    withCodes.map(async (i) => ({
      item: i.item,
      inventoryCode: i.inventoryCode,
      svg: await generateQrCodeSvgMarkup(i.inventoryCode),
    })),
  );

  const title = labels.length === 1 ? `Print Label - ${escapeHtml(labels[0].inventoryCode)}` : 'Print QR Labels';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 0.2in; }
          body { margin: 0; font-family: system-ui, sans-serif; }
          .labels { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 12px; padding: 12px; }
          .label { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; break-inside: avoid; }
          .item-name { font-size: 12px; color: #334155; text-align: center; }
          .code-value { font-size: 11px; font-family: monospace; color: #334155; }
        </style>
      </head>
      <body>
        <div class="labels">
          ${labels
            .map(
              (l) => `
            <div class="label">
              ${l.item ? `<div class="item-name">${escapeHtml(l.item)}</div>` : ''}
              ${l.svg}
              <div class="code-value">${escapeHtml(l.inventoryCode)}</div>
            </div>`,
            )
            .join('')}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
