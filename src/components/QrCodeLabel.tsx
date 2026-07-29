import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export async function generateQrCodeSvgMarkup(value: string, size = 160): Promise<string> {
  return QRCode.toString(value, { type: 'svg', width: size, margin: 1 });
}

export default function QrCodeLabel({
  value,
  itemName,
  size = 128,
}: {
  value: string;
  itemName?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toString(value, { type: 'svg', width: size, margin: 1 })
      .then((svg) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        if (ref.current) ref.current.innerHTML = '';
      });
  }, [value, size]);

  return (
    <div className="flex flex-col items-center">
      {itemName && <div className="text-xs text-slate-500 mb-1">{itemName}</div>}
      <div ref={ref} />
    </div>
  );
}
