import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Accepts input from either a camera scan (html5-qrcode) or a USB/Bluetooth
 * QR code scanner, which behaves like a keyboard typing text followed by Enter.
 */
export default function QrCodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const [manualCode, setManualCode] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'qr-scanner-region';

  useEffect(() => {
    if (!cameraOn) return;
    const scanner = new Html5Qrcode(regionId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText.trim());
        },
        () => {
          // ignore per-frame decode failures
        },
      )
      .catch((err) => setCameraError(err instanceof Error ? err.message : String(err)));

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
    setManualCode('');
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          autoFocus
          className="input font-mono"
          placeholder="Scan with USB scanner or type QR code value, then Enter"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button type="submit" className="btn-primary whitespace-nowrap">
          Add
        </button>
      </form>

      <div>
        <button
          type="button"
          className="text-sm text-primary-600 hover:underline"
          onClick={() => setCameraOn((v) => !v)}
        >
          {cameraOn ? 'Turn off camera scanner' : 'Use camera to scan QR code'}
        </button>
      </div>

      {cameraOn && (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <div id={regionId} />
          {cameraError && <p className="text-xs text-red-600 p-2">{cameraError}</p>}
        </div>
      )}
    </div>
  );
}
