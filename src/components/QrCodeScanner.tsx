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

  // The scan-handling effect below only restarts on `cameraOn`, so it would
  // otherwise close over whatever `onScan` was when the camera turned on.
  // Callers like the scan-in/scan-out toggle create a new `onScan` on every
  // mode switch without turning the camera off, so a stale closure meant the
  // scanner kept dispatching to the mode active when the camera started —
  // it looked like the app didn't notice the switch until you refreshed.
  // Route through a ref so the effect always calls the latest onScan.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!cameraOn) return;
    const scanner = new Html5Qrcode(regionId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;
    // html5-qrcode calls this once per decoded video frame (up to `fps` times a
    // second) for as long as the same code stays in view, so without a cooldown
    // a single scan fires the same onScan (and its Firestore transaction)
    // dozens of times a second — enough to trip Firestore's rate limit. Pause
    // the scanner on a hit and resume after a beat so each code fires once.
    let cooling = false;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (cooling) return;
          cooling = true;
          scanner.pause(true);
          onScanRef.current(decodedText.trim());
          setTimeout(() => {
            cooling = false;
            try {
              scanner.resume();
            } catch {
              // scanner may have been stopped/torn down during the cooldown
            }
          }, 1500);
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
    onScanRef.current(code);
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
