// Shred by QK · native fingertip pulse camera for iPhone (Capacitor plugin "PulseCamera").
// Why native: Safari can't switch the flash on or run the camera above ~30-60 fps. Here the flash is on,
// the frame rate goes up to what the phone supports (120-240 fps on most recent iPhones, which times each
// heartbeat to ~4-8 ms), and exposure, white balance and focus are locked once the fingertip settles.
// It streams average colours to js/vitals.js, which runs the same tested maths as the web app (js/hr.js).
// Install: native/README.md. Not compiled in CI: build and test it on a real iPhone.
import Foundation
import Capacitor
import AVFoundation

@objc(PulseCameraPlugin)
public class PulseCameraPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {
    public let identifier = "PulseCameraPlugin"
    public let jsName = "PulseCamera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.shredbyqk.pulsecamera")
    private var device: AVCaptureDevice?
    // Samples are batched and sent to JavaScript every ~100 ms (sending every frame at 240 fps would flood the bridge).
    private var bt: [Double] = [], br: [Double] = [], bg: [Double] = [], bb: [Double] = []
    private var lastEmit = CACurrentMediaTime()

    @objc func start(_ call: CAPPluginCall) {
        let wanted = call.getDouble("fps") ?? 60
        AVCaptureDevice.requestAccess(for: .video) { granted in
            guard granted else { call.reject("Camera permission denied"); return }
            self.queue.async {
                do {
                    let fps = try self.configure(wanted: wanted)
                    self.session.startRunning()
                    self.setTorch(on: true)
                    // Let auto-exposure settle on the lit fingertip, then freeze it: re-adjustments look like pulse waves.
                    self.queue.asyncAfter(deadline: .now() + 1.5) { self.lockCamera() }
                    call.resolve(["fps": fps])
                } catch {
                    call.reject("Camera setup failed: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            self.setTorch(on: false)
            if self.session.isRunning { self.session.stopRunning() }
            self.bt = []; self.br = []; self.bg = []; self.bb = []
            call.resolve()
        }
    }

    private func pixels(_ f: AVCaptureDevice.Format) -> Int {
        let d = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
        return Int(d.width) * Int(d.height)
    }

    private func configure(wanted: Double) throws -> Double {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }
        session.sessionPreset = .inputPriority  // required to choose the camera format ourselves

        guard let dev = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw NSError(domain: "PulseCamera", code: 1, userInfo: [NSLocalizedDescriptionKey: "No back camera"])
        }
        device = dev
        let input = try AVCaptureDeviceInput(device: dev)
        guard session.canAddInput(input) else { throw NSError(domain: "PulseCamera", code: 2, userInfo: [NSLocalizedDescriptionKey: "Can't use the camera"]) }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(output) else { throw NSError(domain: "PulseCamera", code: 3, userInfo: [NSLocalizedDescriptionKey: "Can't read camera frames"]) }
        session.addOutput(output)

        // The highest frame rate up to `wanted`, then the smallest picture (less work per frame).
        var best: AVCaptureDevice.Format?
        var bestRate = 0.0
        for f in dev.formats {
            let maxRate = f.videoSupportedFrameRateRanges.map { $0.maxFrameRate }.max() ?? 0
            let rate = min(maxRate, wanted)
            if rate > bestRate || (rate == bestRate && best != nil && pixels(f) < pixels(best!)) { best = f; bestRate = rate }
        }
        guard let format = best, bestRate > 0 else { return 30 }
        try dev.lockForConfiguration()
        dev.activeFormat = format
        let frame = CMTime(value: 1, timescale: CMTimeScale(bestRate))
        dev.activeVideoMinFrameDuration = frame
        dev.activeVideoMaxFrameDuration = frame
        dev.unlockForConfiguration()
        return bestRate
    }

    private func setTorch(on: Bool) {
        guard let dev = device, dev.hasTorch else { return }
        do {
            try dev.lockForConfiguration()
            if on { try dev.setTorchModeOn(level: min(1.0, AVCaptureDevice.maxAvailableTorchLevel)) } else { dev.torchMode = .off }
            dev.unlockForConfiguration()
        } catch {}
    }

    private func lockCamera() {
        guard let dev = device else { return }
        do {
            try dev.lockForConfiguration()
            if dev.isExposureModeSupported(.locked) { dev.exposureMode = .locked }
            if dev.isWhiteBalanceModeSupported(.locked) { dev.whiteBalanceMode = .locked }
            if dev.isFocusModeSupported(.locked) { dev.focusMode = .locked }
            dev.unlockForConfiguration()
        } catch {}
    }

    // Average colour of the centre of each frame, timed by when the camera captured it.
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(pb)?.assumingMemoryBound(to: UInt8.self) else { return }
        let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb), row = CVPixelBufferGetBytesPerRow(pb)
        var r = 0.0, g = 0.0, b = 0.0, n = 0.0
        let step = max(1, min(w, h) / 48)
        var y = h / 4
        while y < h * 3 / 4 {
            var x = w / 4
            while x < w * 3 / 4 {
                let p = base + y * row + x * 4  // BGRA
                b += Double(p[0]); g += Double(p[1]); r += Double(p[2]); n += 1
                x += step
            }
            y += step
        }
        guard n > 0 else { return }
        bt.append(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer)))
        br.append(r / n); bg.append(g / n); bb.append(b / n)
        let now = CACurrentMediaTime()
        if now - lastEmit > 0.1 {
            notifyListeners("samples", data: ["t": bt, "r": br, "g": bg, "b": bb])
            bt = []; br = []; bg = []; bb = []
            lastEmit = now
        }
    }
}
